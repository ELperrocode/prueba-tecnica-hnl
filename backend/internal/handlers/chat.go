package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/henry/banca-online/internal/config"
	"github.com/henry/banca-online/internal/mcp"
	"github.com/henry/banca-online/internal/models"
	"github.com/henry/banca-online/internal/services"
)

type ChatHandler struct {
	toolRegistry *mcp.ToolRegistry
	accountSvc   *services.AccountService
	cfg          *config.Config
}

func NewChatHandler(toolRegistry *mcp.ToolRegistry, accountSvc *services.AccountService, cfg *config.Config) *ChatHandler {
	return &ChatHandler{
		toolRegistry: toolRegistry,
		accountSvc:   accountSvc,
		cfg:          cfg,
	}
}

// openRouterMessage represents a message in the OpenRouter API format
type openRouterMessage struct {
	Role       string      `json:"role"`
	Content    interface{} `json:"content"`
	ToolCalls  []toolCall  `json:"tool_calls,omitempty"`
	ToolCallID string      `json:"tool_call_id,omitempty"`
	Name       string      `json:"name,omitempty"`
}

type toolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function toolFunction `json:"function"`
}

type toolFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type openRouterRequest struct {
	Model    string              `json:"model"`
	Messages []openRouterMessage `json:"messages"`
	Tools    interface{}         `json:"tools,omitempty"`
}

type openRouterResponse struct {
	Choices []struct {
		Message      openRouterMessage `json:"message"`
		FinishReason string            `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Chat POST /api/chat
func (h *ChatHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromCtx(r)

	var req models.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Message == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message is required"})
		return
	}

	if h.cfg.OpenRouterAPIKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "AI chat is not configured. Set OPENROUTER_API_KEY environment variable.",
		})
		return
	}

	// Get user's accounts for context
	accounts, _ := h.accountSvc.GetUserAccounts(userID)
	accountsInfo := "User accounts:\n"
	for _, a := range accounts {
		accountsInfo += fmt.Sprintf("- %s (%s, %s): $%.2f\n", a.AccountNumber, a.AccountType, a.Currency, a.Balance)
	}

	// System prompt
	systemPrompt := fmt.Sprintf(`You are a helpful banking assistant for an online banking system. You help users manage their bank accounts, check balances, make transfers, deposits, and withdrawals.

RULES:
1. Execute financial operations (deposit, withdrawal, transfer) directly when the user requests them — do not ask for confirmation first.
2. Always be clear about what operation you performed and show the result.
3. Respond in the same language the user uses (Spanish or English).
4. Be concise but helpful.

Current user information:
%s`, accountsInfo)

	// Build conversation messages: system + history + current user message
	messages := []openRouterMessage{
		{Role: "system", Content: systemPrompt},
	}
	for _, h := range req.History {
		if h.Role == "user" || h.Role == "assistant" {
			messages = append(messages, openRouterMessage{Role: h.Role, Content: h.Content})
		}
	}
	messages = append(messages, openRouterMessage{Role: "user", Content: req.Message})

	// Call OpenRouter with tool-use loop (max 5 iterations)
	tools := h.toolRegistry.ToOpenRouterTools()
	var finalResponse string

	for i := 0; i < 5; i++ {
		assistantMsg, err := h.callOpenRouter(messages, tools)
		if err != nil {
			log.Printf("OpenRouter error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "AI service error: " + err.Error()})
			return
		}

		// If no tool calls, we have the final text response
		if len(assistantMsg.ToolCalls) == 0 {
			if content, ok := assistantMsg.Content.(string); ok {
				finalResponse = content
			} else {
				finalResponse = fmt.Sprintf("%v", assistantMsg.Content)
			}
			break
		}

		// Add assistant message to conversation
		messages = append(messages, *assistantMsg)

		// Execute each tool call
		for _, tc := range assistantMsg.ToolCalls {
			result, err := h.toolRegistry.ExecuteTool(r.Context(), userID, tc.Function.Name, tc.Function.Arguments)
			var content string
			if err != nil {
				content = fmt.Sprintf("Error: %s", err.Error())
			} else {
				content = result.Content
			}

			messages = append(messages, openRouterMessage{
				Role:       "tool",
				Content:    content,
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
			})
		}
	}

	if finalResponse == "" {
		finalResponse = "I apologize, I wasn't able to process your request. Please try again."
	}

	writeJSON(w, http.StatusOK, models.ChatResponse{
		Response: finalResponse,
	})
}

func (h *ChatHandler) callOpenRouter(messages []openRouterMessage, tools interface{}) (*openRouterMessage, error) {
	reqBody := openRouterRequest{
		Model:    h.cfg.OpenRouterModel,
		Messages: messages,
		Tools:    tools,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+h.cfg.OpenRouterAPIKey)

	httpClient := &http.Client{Timeout: 110 * time.Second}
	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("calling OpenRouter: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	var orResp openRouterResponse
	if err := json.Unmarshal(respBody, &orResp); err != nil {
		return nil, fmt.Errorf("parsing response: %w (body: %s)", err, string(respBody[:min(len(respBody), 200)]))
	}

	if orResp.Error != nil {
		return nil, fmt.Errorf("OpenRouter API error: %s", orResp.Error.Message)
	}

	if len(orResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	return &orResp.Choices[0].Message, nil
}

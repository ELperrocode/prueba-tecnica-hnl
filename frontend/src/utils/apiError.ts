/** Extracts a human-readable error message from an Axios error response. */
export function getApiError(err: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { error?: string } } }).response
    if (res?.data?.error) return res.data.error
  }
  if (err instanceof Error) return err.message
  return fallback
}

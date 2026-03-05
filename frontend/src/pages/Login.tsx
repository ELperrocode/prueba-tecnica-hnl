import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import { getApiError } from '../utils/apiError'
import AuthCard from '../components/ui/AuthCard'
import FormField from '../components/ui/FormField'
import ErrorBanner from '../components/ui/ErrorBanner'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: unknown) {
      setError(getApiError(err, 'Error al iniciar sesión'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="BancaHNL" subtitle="Sistema de Banca en Línea">
      <h2 className="text-lg font-semibold text-slate-900 mb-5">Iniciar Sesión</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorBanner message={error} />

        <FormField
          label="Correo Electrónico"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          autoComplete="email"
        />

        <FormField
          label="Contraseña"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm mt-2"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="text-violet-600 hover:underline font-medium">
          Regístrate
        </Link>
      </p>
    </AuthCard>
  )
}

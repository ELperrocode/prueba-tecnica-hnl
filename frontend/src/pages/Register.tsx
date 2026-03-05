import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import { getApiError } from '../utils/apiError'
import AuthCard from '../components/ui/AuthCard'
import FormField from '../components/ui/FormField'
import ErrorBanner from '../components/ui/ErrorBanner'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await register(email, password, fullName)
      navigate('/')
    } catch (err: unknown) {
      setError(getApiError(err, 'Error al registrarse'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="BancaHNL" subtitle="Crea tu cuenta bancaria gratis">
      <h2 className="text-lg font-semibold text-slate-900 mb-5">Crear Cuenta</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorBanner message={error} />

        <FormField
          label="Nombre Completo"
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Juan Pérez"
          required
          autoComplete="name"
        />

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
          placeholder="Mínimo 6 caracteres"
          required
          minLength={6}
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm mt-2"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-violet-600 hover:underline font-medium">
          Inicia sesión
        </Link>
      </p>
    </AuthCard>
  )
}


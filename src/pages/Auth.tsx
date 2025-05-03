import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const { loginStaff, staff, loading } = useAuth();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Only navigate if staff is set and there is no error
    if (staff && !error) {
      navigate('/');
    }
  }, [staff, error, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { error } = await loginStaff(name, pin);
    if (error) setError(error);
    // navigation now handled by useEffect
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-6" autoComplete="on">
        <h1 className="text-2xl font-bold text-center mb-2">Staff Login</h1>
        <div>
          <label className="block mb-1 font-medium">Name</label>
          <Input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus autoComplete="username" />
        </div>
        <div>
          <label className="block mb-1 font-medium">PIN</label>
          <Input type="password" value={pin} onChange={e => setPin(e.target.value)} required minLength={5} maxLength={6} inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" />
        </div>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </form>
    </div>
  );
};

export default Auth; 
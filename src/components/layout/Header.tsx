import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Header = () => {
  const { staff, logout, loading } = useAuth();

  return (
    <header className="w-full flex items-center justify-between px-4 py-2 bg-white shadow">
      <div className="font-bold text-xl">Creamello POS</div>
      <div>
        {loading ? null : staff ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{staff.name} ({staff.role})</span>
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </div>
        ) : (
          <Link to="/auth">
            <Button variant="outline" size="sm">Login</Button>
          </Link>
        )}
      </div>
    </header>
  );
};

export default Header;

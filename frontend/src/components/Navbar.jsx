import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar() {
  const { user, signOut } = useAuth();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">Lectern</Link>
        {user && (
          <>
            <nav className="nav-links">
              <NavLink to="/" end>All courses</NavLink>
              <NavLink to="/my">{user.role === 'instructor' ? 'Teaching' : 'My learning'}</NavLink>
            </nav>
            <div className="nav-user">
              <span>{user.name}</span>
              <button className="btn btn-quiet" onClick={signOut}>Sign out</button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

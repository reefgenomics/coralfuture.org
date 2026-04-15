// External imports
import React, { useContext } from 'react';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
// Internal imports
// Contexts
import { AuthContext } from 'contexts/AuthContext'

const NavigationBar = () => {

  const { authData, logout } = useContext(AuthContext);
  const backendUrl = '';
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    try {
      const result = await logout(backendUrl);
      if (result.success) {
        // Redirect to home page after logout
        navigate('/');
      } else {
        console.error('Logout error:', result.error);
        // Still redirect even if logout failed
        navigate('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
  };

  return (
    <Navbar 
      expand="lg" 
      bg="light" 
      fixed="top" 
      style={{ 
        zIndex: 1050, 
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
      }}
    >
      <Container>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <span className="fw-bold">CoralFuture</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="navbarNav" />
        <Navbar.Collapse id="navbarNav">
          <Nav className="navbar-nav me-auto">
            <Nav.Item>
              <Nav.Link 
                as={Link} 
                to="/" 
                className={isActive('/') ? 'active fw-medium' : ''}
              >
                <i className="bi bi-house"></i> Home
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link 
                as={Link} 
                to="/map" 
                className={isActive('/map') ? 'active fw-medium' : ''}
              >
                <i className="bi bi-map"></i> Map
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link 
                as={Link} 
                to="/projects" 
                className={isActive('/projects') ? 'active fw-medium' : ''}
              >
                <i className="bi bi-journal-text"></i> Projects
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link 
                as={Link}
                to={(() => {
                  const envUrl = process.env.REACT_APP_SHINY_URL;
                  if (envUrl) return envUrl.replace(window.location.origin, '') || '/ed-calculator/';
                  return '/ed-calculator/';
                })()}
                className={isActive('/ed-calculator') ? 'active fw-medium' : ''}
              >
                <i className="bi bi-journal-text"></i> ED Calculator
              </Nav.Link>
            </Nav.Item>

            {authData.authenticated && (
              <Nav.Item>
                <Nav.Link 
                  as={Link} 
                  to="/upload" 
                  className={isActive('/upload') ? 'active fw-medium' : ''}
                >
                  <i className="bi bi-upload"></i> Upload to Database
                </Nav.Link>
              </Nav.Item>
            )}


            <Nav.Item>
              <Nav.Link href="https://www.biologie.uni-konstanz.de/voolstra/">
                <i className="bi bi-person"></i> About Us
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link href="https://github.com/greenjune-ship-it/coral-future/issues">
                <i className="bi bi-question-circle"></i> Get Help
              </Nav.Link>
            </Nav.Item>

          </Nav>
        </Navbar.Collapse>

        <div className="ms-lg-4">
          {authData.authenticated ? (
            <NavDropdown title={<>{authData.username} <i className="bi bi-person-circle"></i></>} id="basic-nav-dropdown">
              <NavDropdown.Item as={Link} to="/cart">
                <i className="bi bi-cart"></i> Cart
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>
                <i className="bi bi-box-arrow-right"></i> Logout
              </NavDropdown.Item>
            </NavDropdown>
          ) : (
            <Nav.Item>
              <Nav.Link as={Link} to="/login" className="default-link" style={{ color: '#0a58ca' }}>
                <i className="bi bi-box-arrow-in-right"></i> Login
              </Nav.Link>
            </Nav.Item>
          )}
        </div>
      </Container>
    </Navbar>
  );
};

export default NavigationBar;

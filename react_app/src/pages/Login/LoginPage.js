import React, { useState, useContext } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from 'contexts/AuthContext';
import { PersonCircle, BoxArrowInRight, ExclamationTriangle, CheckCircle, Lock } from 'react-bootstrap-icons';
import './LoginPage.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { authData, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  
  // Redirect if already authenticated
  React.useEffect(() => {
    if (authData.authenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [authData.authenticated, navigate, location]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    console.log('LoginPage: Form submitted!', { formData, backendUrl });
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('LoginPage: Calling login function...');
      const result = await login(backendUrl, formData);
      console.log('LoginPage: Login result:', result);
      
      if (result.success) {
        setSuccess('Login successful! Redirecting...');
        // Redirect after a short delay
        setTimeout(() => {
          const from = location.state?.from?.pathname || '/';
          navigate(from, { replace: true });
        }, 1000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('LoginPage: Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background Image */}
      <div className="login-background"></div>
      
      <Container fluid className="login-container">
        <Row className="justify-content-center align-items-center min-vh-100">
          <Col xs={12} sm={10} md={8} lg={6} xl={5}>
            <Card className="login-card">
              <Card.Body className="p-5">
                {/* Header */}
                <div className="login-header text-center mb-5">
                  <div className="login-icon-wrapper">
                    <PersonCircle className="login-icon" />
                  </div>
                  <h1 className="login-title">Welcome Back</h1>
                  <p className="login-subtitle">Sign in to your CoralFuture account</p>
                </div>

                {/* Alerts */}
                {error && (
                  <Alert variant="danger" dismissible onClose={() => setError('')} className="login-alert">
                    <ExclamationTriangle className="me-2" />
                    {error}
                  </Alert>
                )}
                
                {success && (
                  <Alert variant="success" className="login-alert">
                    <CheckCircle className="me-2" />
                    {success}
                  </Alert>
                )}

                {/* Login Form */}
                <Form onSubmit={handleSubmit} method="post" className="login-form">
                  <Form.Group className="mb-4">
                    <Form.Label htmlFor="username" className="form-label">
                      <PersonCircle className="me-2" />
                      Username
                    </Form.Label>
                    <Form.Control
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="Enter your username"
                      required
                      disabled={loading}
                      className="form-input"
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label htmlFor="password" className="form-label">
                      <Lock className="me-2" />
                      Password
                    </Form.Label>
                    <Form.Control
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                      className="form-input"
                    />
                  </Form.Group>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="login-button w-100 mb-4"
                    disabled={loading || !formData.username || !formData.password}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <BoxArrowInRight className="me-2" />
                        Sign In
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <small className="login-help-text">
                      Don't have an account? Contact your administrator for access.
                    </small>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default LoginPage;
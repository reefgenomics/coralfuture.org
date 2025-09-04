import React from 'react';
import { Container, Row, Col, Button, Card, Badge } from 'react-bootstrap';
import { 
  Globe, 
  Map, 
  GraphUp, 
  Upload, 
  Database, 
  Search,
  Shield,
  People,
  JournalText,
  Star,
  Book,
  Github,
  Envelope
} from 'react-bootstrap-icons';
import 'bootstrap/dist/css/bootstrap.min.css';
import './HomePage.css';

// Debug: Log available icons
console.log('Available icons:', {
  Globe, Map, GraphUp, Upload, Database, 
  Search, Shield, People, JournalText, Star,
  Book, Github, Envelope
});

const HomePage = () => {
  const features = [
    {
      icon: <Map className="feature-icon" />,
      title: "Interactive Coral Map",
      description: "Explore coral colonies worldwide with our interactive mapping system. Filter by species, location, and thermal tolerance data.",
      color: "primary"
    },
    {
      icon: <GraphUp className="feature-icon" />,
      title: "ED50 Calculator",
      description: "Advanced thermal tolerance analysis tools for researchers. Calculate ED50 values and generate comprehensive reports.",
      color: "success"
    },
    {
      icon: <Database className="feature-icon" />,
      title: "Data Repository",
      description: "Access and contribute to our growing database of coral research data from global studies and experiments.",
      color: "info"
    },
    {
      icon: <Upload className="feature-icon" />,
      title: "Data Upload",
      description: "Share your research findings by uploading CSV datasets. Our AI-powered system ensures data quality and consistency.",
      color: "warning"
    }
  ];


  const cbassFeatures = [
    {
      title: "CBASS assays",
      description: "A portable experimental system to run standardized short-term acute heat stress assays. CBASS assays allow determination of the ED50, the standardized temperature threshold at which 50% of initial photosystem efficiency is lost.",
      references: [
        "Evensen et al. 2023",
        "Voolstra et al. 2020", 
        "Voolstra et al. 2021",
        "Savary et al. 2021",
        "Evensen et al. 2021"
      ],
      icon: <GraphUp className="cbass-icon" />
    },
    {
      title: "R Package",
      description: "R package to process CBASS-derived PAM data. Minimal requirements are PAM data (or data from any other continuous variable that changes with temperature, e.g. relative bleaching scores) from 4 samples (e.g., nubbins) subjected to 4 temperature profiles of at least 2 colonies from 1 coral species from 1 site.",
      references: [
        "Source Code",
        "Zenodo Record"
      ],
      icon: <Book className="cbass-icon" />
    }
  ];

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background-image"></div>
        <div className="hero-content">
          <div className="hero-badge">
            🌊 Marine Research Platform
          </div>
          
          <h1 className="hero-title">
            CoralFuture
          </h1>
          
          <p className="hero-subtitle">
            Advancing <span className="highlight">coral reef research</span> through{' '}
            <span className="secondary-highlight">data science</span>,{' '}
            <span className="highlight">thermal tolerance analysis</span>, and{' '}
            <span className="secondary-highlight">global collaboration</span> for{' '}
            <span className="highlight">marine conservation</span>.
          </p>
          
          <div className="hero-actions">
            <a href="#features" className="hero-btn">
              Explore Features
            </a>
            <a href="#contribute" className="hero-btn primary">
              Get Started
            </a>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <Container>
          <Row className="text-center g-4">
            <Col md={3}>
              <div className="stat-item">
                <div className="stat-number">1000+</div>
                <div className="stat-label">Coral Colonies</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item">
                <div className="stat-number">50+</div>
                <div className="stat-label">Research Projects</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item">
                <div className="stat-number">25+</div>
                <div className="stat-label">Countries</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="stat-item">
                <div className="stat-number">24/7</div>
                <div className="stat-label">Data Access</div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* CBASS System Section */}
      <section className="cbass-section">
        <Container>
          <Row className="justify-content-center text-center mb-5">
            <Col lg={8}>
              <h2 className="section-title">CBASS Research Tools</h2>
              <p className="section-subtitle">
                Advanced experimental systems and software for coral thermal tolerance research
              </p>
            </Col>
          </Row>
          
          <Row className="g-4">
            {cbassFeatures.map((feature, index) => (
              <Col lg={6} key={index}>
                <Card className="cbass-card h-100 border-0 shadow">
                  <Card.Body className="p-4">
                    <div className="cbass-icon-wrapper mb-3">
                      {feature.icon}
                    </div>
                    <h4 className="card-title fw-bold mb-3 text-primary">{feature.title}</h4>
                    <p className="card-text mb-4">{feature.description}</p>
                    
                    <div className="references-section">
                      <h6 className="fw-semibold mb-3 text-muted">References:</h6>
                      <div className="references-list">
                        {feature.references.map((ref, refIndex) => (
                          <Badge 
                            key={refIndex} 
                            bg="light" 
                            text="dark" 
                            className="me-2 mb-2 px-3 py-2"
                          >
                            {ref}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <Container>
          <Row className="justify-content-center text-center mb-5">
            <Col lg={8}>
              <h2 className="section-title">Platform Features</h2>
              <p className="section-subtitle">
                Discover the powerful tools and capabilities that make CoralFuture the leading platform for coral research
              </p>
            </Col>
          </Row>
          
          <Row className="g-4">
            {features.map((feature, index) => (
              <Col lg={6} key={index}>
                <Card className={`feature-card h-100 border-0 shadow-sm feature-${feature.color}`}>
                  <Card.Body className="p-4 text-center">
                    <div className={`feature-icon-wrapper bg-${feature.color} bg-opacity-10 mb-3`}>
                      {feature.icon}
                    </div>
                    <h5 className="card-title fw-bold mb-3">{feature.title}</h5>
                    <p className="card-text text-muted">{feature.description}</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Contribute Section */}
      <section id="contribute" className="contribute-section">
        <Container>
          <Row className="justify-content-center text-center mb-5">
            <Col lg={8}>
              <h2 className="section-title">Contribute to CoralFuture</h2>
              <p className="section-subtitle">
                Join our global community of researchers and help expand our coral reef database
              </p>
              
              <div className="contribute-info">
                <p className="mb-4">
                  If you want to contribute to our database, please have a look first at our{' '}
                  <a href="https://github.com/greenjune-ship-it/coral-future" target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                    <strong>Wiki page</strong>
                  </a>. Then contact{' '}
                  <a href="mailto:coralfuture.org@gmail.com" className="text-decoration-none">
                    <strong>coralfuture.org@gmail.com</strong>
                  </a>.
                </p>
              </div>
              
              <div className="contribute-actions">
                <Button 
                  href="https://github.com/greenjune-ship-it/coral-future" 
                  variant="light" 
                  size="lg" 
                  className="me-3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="me-2" />
                  View on GitHub
                </Button>
                <Button 
                  href="/upload" 
                  variant="outline-light" 
                  size="lg"
                >
                  <Upload className="me-2" />
                  Upload Data
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
};

export default HomePage;

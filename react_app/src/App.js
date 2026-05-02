// External imports
import React, { useContext } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
// Internal imports
// Contexts
import AuthContextProvider, { AuthContext } from 'contexts/AuthContext'
import UserCartContextProvider from 'contexts/UserCartContext';
// Pages
import HomePage from 'pages/Home/HomePage';
import CustomerCart from 'pages/Cart/CustomerCart';
import CustomerMap from 'pages/Map/CustomerMap';
import UploadDataPage from 'pages/Upload/UploadDataPage';
import LoginPage from 'pages/Login/LoginPage';
import ProjectsPage from 'pages/Projects/ProjectsPage';
import ProjectDetailPage from 'pages/ProjectDetail/ProjectDetailPage';
import ED50CalculatorPage from 'pages/ED50Calculator/ED50CalculatorPage';
import ChatPage from 'pages/Chat/ChatPage';
import EditProfilePage from 'pages/Profile/EditProfilePage';
import PublicProfilePage from 'pages/Profile/PublicProfilePage';
// Components
import NavigationBar from 'components/Navbar/Navbar';

const ProfileRedirect = () => {
  const { authData, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!authData.authenticated) return <Navigate to="/login" replace />;
  return <Navigate to={`/users/${authData.username}`} replace />;
};


const App = () => {
  return (
    <AuthContextProvider>
      <UserCartContextProvider>
        <Router>
          <div>
            {/* NavigationBar can be rendered on all routes */}
            <NavigationBar />
            <Routes>
              <Route path='/' element={<HomePage />} />
              <Route path='/map' element={<CustomerMap />} />
              <Route path="/cart" element={<CustomerCart />} />
              <Route path="/upload" element={<UploadDataPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/project/:projectId" element={<ProjectDetailPage />} />
              <Route path="/profile" element={<ProfileRedirect />} />
              <Route path="/users/:username" element={<PublicProfilePage />} />
              <Route path="/users/:username/edit" element={<EditProfilePage />} />
              <Route path="/ed-calculator" element={<ED50CalculatorPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Routes>
          </div>
          
          {/* Global styles */}
          <style>
            {`
              body {
                margin: 0;
                padding: 0;
              }
              
              .navbar {
                height: 56px;
              }
              
              .leaflet-container {
                height: 100%;
                width: 100%;
              }

              .maplibregl-map {
                height: 100%;
                width: 100%;
              }
            `}
          </style>
        </Router>
      </UserCartContextProvider>
    </AuthContextProvider>
  );
};

export default App;

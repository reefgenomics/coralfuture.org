// External imports
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
// Internal imports
// Contexts
import AuthContextProvider from 'contexts/AuthContext'
import UserCartContextProvider from 'contexts/UserCartContext';
// Pages
import CustomerCart from 'pages/Cart/CustomerCart';
import CustomerMap from 'pages/Map/CustomerMap';
import UploadDataPage from 'pages/Upload/UploadDataPage';
// Components
import NavigationBar from 'components/Navbar/Navbar';


const App = () => {
  return (
    <AuthContextProvider>
      <UserCartContextProvider>
        <Router>
          <div style={{ overflow: 'hidden' }}>
            {/* NavigationBar can be rendered on all routes */}
            <NavigationBar />
            <Routes>
              <Route path='/map' element={<CustomerMap />} />
              <Route path="/cart" element={<CustomerCart />} />
              <Route path="/upload" element={<UploadDataPage />} />
            </Routes>
          </div>
          
          {/* Global styles */}
          <style>
            {`
              body {
                margin: 0;
                padding: 0;
                overflow: hidden;
              }
              
              .navbar {
                height: 56px;
              }
              
              .leaflet-container {
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

import axios from 'axios';
import React, { useState, useEffect, createContext } from 'react';

export const AuthContext = createContext();

const AuthContextProvider = (props) => {
  const [authData, setAuthData] = useState({ username: '', authenticated: false });
  const [loading, setLoading] = useState(true);

  const checkAuthentication = async (backendUrl) => {
    try {
      setLoading(true);
      const response = await axios.get(`${backendUrl}/api/auth/status/`, {
        withCredentials: true,
      });

      const { username, authenticated } = response.data;
      setAuthData({
        username: username, 
        authenticated: authenticated
      });
      console.log('Authentication status checked:', { username, authenticated });

    } catch (error) {
      console.error('Error checking authentication:', error);
      setAuthData({ username: '', authenticated: false });
    } finally {
      setLoading(false);
    }
  };

  const login = async (backendUrl, credentials) => {
    try {
      setLoading(true);
      
      // Get CSRF token first
      const csrfResponse = await axios.get(`${backendUrl}/api/auth/csrf/`, {
        withCredentials: true,
      });

      // Perform login
      const loginResponse = await axios.post(`${backendUrl}/api/auth/login/`, credentials, {
        withCredentials: true,
        headers: {
          'X-CSRFToken': csrfResponse.data.csrfToken,
          'Content-Type': 'application/json'
        }
      });

      if (loginResponse.data.success) {
        // Refresh authentication status
        await checkAuthentication(backendUrl);
        return { success: true, message: loginResponse.data.message };
      } else {
        return { success: false, error: loginResponse.data.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.data?.error) {
        return { success: false, error: error.response.data.error };
      } else if (error.response?.status === 401) {
        return { success: false, error: 'Invalid username or password' };
      } else {
        return { success: false, error: 'Login failed. Please try again.' };
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async (backendUrl) => {
    try {
      setLoading(true);
      
      // Get CSRF token first
      const csrfResponse = await axios.get(`${backendUrl}/api/auth/csrf/`, {
        withCredentials: true,
      });

      // Perform logout
      const logoutResponse = await axios.post(`${backendUrl}/api/auth/logout/`, {}, {
        withCredentials: true,
        headers: {
          'X-CSRFToken': csrfResponse.data.csrfToken,
          'Content-Type': 'application/json'
        }
      });

      if (logoutResponse.data.success) {
        // Clear local auth data
        setAuthData({ username: '', authenticated: false });
        return { success: true, message: logoutResponse.data.message };
      } else {
        return { success: false, error: logoutResponse.data.error };
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails on server, clear local auth data
      setAuthData({ username: '', authenticated: false });
      return { success: false, error: 'Logout failed, but you have been logged out locally.' };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthentication('');
  }, []);

  return (
    <AuthContext.Provider value={{ 
      authData, 
      loading,
      checkAuthentication, 
      login, 
      logout 
    }}>
      {props.children}
    </AuthContext.Provider>
  );
};

export default AuthContextProvider;

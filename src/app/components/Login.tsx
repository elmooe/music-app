'use client';

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './Login.module.css';

interface LoginProps {
  onLoginSuccess(): void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    try {
      await invoke('register_user_command', { username, password });
      setMessage('Registration successful! You can now log in.');
      setIsRegistering(false);
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
  };

  const handleLogin = async () => {
    try {
      const isAuthenticated = await invoke<boolean>('login_user_command', {
        username,
        password,
      });
      if (isAuthenticated) {
        setMessage('Login successful!');
        onLoginSuccess();
      } else {
        setMessage('Invalid username or password.');
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <>
      <div className={styles.bgGif}></div>
      <div className={styles.login}>
        <div className={styles.formContainer}>
          <h1>{isRegistering ? 'Register' : 'Login'}</h1>
    
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
    
          {isRegistering ? (
            <div className={styles.passwordField}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={togglePasswordVisibility}
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
          ) : (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
    
          <button onClick={isRegistering ? handleRegister : handleLogin}>
            {isRegistering ? 'Register' : 'Login'}
          </button>
    
          <p>{message}</p>
    
          <button onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Back to Login' : 'Create an Account'}
          </button>
        </div>
      </div>
    </>
  );  
}  

export default Login;
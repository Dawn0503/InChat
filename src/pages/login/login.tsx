import React, { useState } from 'react';
import { TextField, Button, Typography, Container, Box } from '@mui/material';
import { loginAPI } from '@/apis/login';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await loginAPI(username, password);
      console.log('登录响应:', response);
      if (response.data && response.data.token) {
        localStorage.setItem('token', response.data.token);
        window.location.href = '/chat';
      } else {
        console.error('登录失败，未返回 token');
      }
    } catch (error: any) {
      console.error('登录请求失败:', error);
      if (error.response) {
        console.error('响应错误:', error.response);
      }
      if (error.request) {
        console.error('请求错误:', error.request);
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.3)), url('/anime-bg.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
            },
          }}
        >
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom
            sx={{
              fontWeight: 600,
              color: '#262626',
              mb: 3
            }}
          >
            登录
          </Typography>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            label="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#1976d2',
                },
              },
            }}
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#1976d2',
                },
              },
            }}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleLogin}
            sx={{
              mt: 3,
              mb: 2,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              boxShadow: '0 2px 8px 0 rgba(25,118,210,0.3)',
              '&:hover': {
                boxShadow: '0 4px 12px 0 rgba(25,118,210,0.4)',
              },
            }}
          >
            登录
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
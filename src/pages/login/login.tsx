import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Container, Box, Tabs, Tab, Alert, Snackbar } from '@mui/material';
import { loginAPI, registerAPI } from '@/apis/login';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tabValue, setTabValue] = useState(0); // 0: 登录, 1: 注册
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 组件挂载时检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // 已登录，跳转到聊天页面
      window.location.href = '/chat';
    }
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setErrorMsg('请输入用户名和密码');
      return;
    }

    try {
      const response = await loginAPI(username, password);
      console.log('登录响应:', response);
      
      // 处理直接返回token的情况和通过data属性返回token的情况
      const responseData = response.data || response;
      
      if (responseData) {
        // 存储 token 和 refreshToken
        if (responseData.accessToken) {
          localStorage.setItem('token', responseData.accessToken);
        } else if (responseData.token) {
          localStorage.setItem('token', responseData.token);
        }
        
        // 存储 refreshToken
        if (responseData.refreshToken) {
          localStorage.setItem('refreshToken', responseData.refreshToken);
        }
        
        // 存储用户 ID
        if (responseData.user && responseData.user.id) {
          localStorage.setItem('id', responseData.user.id);
        }
        
        window.location.href = '/chat';
      } else {
        setErrorMsg('登录失败，未返回 token');
      }
    } catch (error: any) {
      console.error('登录请求失败:', error);
      if (error.response) {
        console.error('响应错误:', error.response);
        setErrorMsg(error.response.data?.message || '登录失败');
      } else {
        setErrorMsg('登录失败，请检查网络连接');
      }
    }
  };

  const handleRegister = async () => {
    if (!username || !password) {
      setErrorMsg('请输入用户名和密码');
      return;
    }
    
    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致');
      return;
    }

    try {
      const response = await registerAPI(username, password);
      console.log('注册响应:', response);
      
      // 处理直接返回和通过data返回的情况
      const responseData = response.data || response;
      
      if (responseData && (responseData.message === '注册成功' || responseData.userId)) {
        setSuccessMsg('注册成功! 请登录');
        // 清空输入框，并切换到登录选项卡
        setUsername(username); // 保留用户名
        setPassword('');
        setConfirmPassword('');
        setTabValue(0);
      } else {
        setErrorMsg(responseData?.message || '注册失败');
      }
    } catch (error: any) {
      console.error('注册请求失败:', error);
      if (error.response) {
        console.error('响应错误:', error.response);
        setErrorMsg(error.response.data?.message || '注册失败');
      } else {
        setErrorMsg('注册失败，请检查网络连接');
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
              mb: 2
            }}
          >
            {tabValue === 0 ? '登录' : '注册'}
          </Typography>

          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{ 
              mb: 3,
              '& .MuiTab-root': {
                fontWeight: 500,
                minWidth: 100
              }
            }}
          >
            <Tab label="登录" />
            <Tab label="注册" />
          </Tabs>

          {errorMsg && (
            <Alert 
              severity="error" 
              sx={{ width: '100%', mb: 2 }}
              onClose={() => setErrorMsg('')}
            >
              {errorMsg}
            </Alert>
          )}

          {successMsg && (
            <Alert 
              severity="success" 
              sx={{ width: '100%', mb: 2 }}
              onClose={() => setSuccessMsg('')}
            >
              {successMsg}
            </Alert>
          )}

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

          {tabValue === 1 && (
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              label="确认密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: '#1976d2',
                  },
                },
              }}
            />
          )}

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={tabValue === 0 ? handleLogin : handleRegister}
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
            {tabValue === 0 ? '登录' : '注册'}
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
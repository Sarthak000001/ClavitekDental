import axios from 'axios';

// Create an Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // Crucial for sending/receiving HttpOnly cookies
});

// Optional: Axios request interceptor for logging or adding headers
api.interceptors.request.use(
  (config) => {
    // If you were using localStorage for tokens instead of cookies,
    // you would attach the token here:
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: Axios response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized errors globally (e.g., redirect to login)
      console.warn('Unauthorized access. Please login.');
      // window.location.href = '/login'; // Or use React Context to trigger UI updates
    }
    return Promise.reject(error);
  }
);

export default api;

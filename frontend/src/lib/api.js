import axios from 'axios'
import { supabase } from './supabase'

// Automatically detect API URL based on current hostname
// This allows the app to work on localhost and on local network
function getApiUrl() {
  // If explicitly set in env, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Otherwise, use the current hostname with port 3000
  // This works for both localhost and network IPs
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const apiUrl = `${protocol}//${hostname}:3000`
  
  // Log for debugging
  console.log('API URL detected:', apiUrl)
  
  return apiUrl
}

const API_URL = getApiUrl()

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000, // 30 second timeout
})

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  console.log('API Request:', config.method?.toUpperCase(), config.url, 'to', config.baseURL)
  return config
}, (error) => {
  console.error('Request error:', error)
  return Promise.reject(error)
})

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
      baseURL: error.config?.baseURL
    })
    
    // Provide more helpful error messages
    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'Request timed out. Check if the backend server is running.'
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      error.userMessage = `Cannot connect to backend server at ${API_URL}. Make sure the backend is running and accessible.`
    } else if (error.response) {
      error.userMessage = error.response.data?.error || `Server error: ${error.response.status}`
    } else {
      error.userMessage = error.message || 'An unknown error occurred'
    }
    
    return Promise.reject(error)
  }
)

export default api


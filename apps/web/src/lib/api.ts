import axios, { AxiosInstance, AxiosError } from "axios";
import { ApiResponse, ERROR_CODES } from "@shared/types";

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "/api"),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("supabase_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("supabase_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function apiCall<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  data?: unknown
): Promise<T> {
  try {
    const config =
      method === "GET" ? {} : { data };

    const response = await api<ApiResponse<T>>({
      method,
      url: endpoint,
      ...config,
    });

    if (!response.data.success) {
      throw new APIError(
        response.data.error?.code || ERROR_CODES.INTERNAL_ERROR,
        response.data.error?.message || "Unknown error",
        response.status
      );
    }

    return response.data.data as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const data = error.response?.data as ApiResponse<unknown>;
      throw new APIError(
        data?.error?.code || ERROR_CODES.NETWORK_ERROR,
        data?.error?.message || error.message,
        error.response?.status || 500
      );
    }

    throw new APIError(
      ERROR_CODES.INTERNAL_ERROR,
      "An unexpected error occurred",
      500
    );
  }
}

// Attendance endpoints
export const attendanceAPI = {
  getAll: () => apiCall<unknown[]>("GET", "/attendance"),
  getBySubject: (courseId: string) =>
    apiCall<unknown>("GET", `/attendance/${courseId}`),
  create: (data: unknown) =>
    apiCall<unknown>("POST", "/attendance", data),
  update: (id: string, data: unknown) =>
    apiCall<unknown>("PUT", `/attendance/${id}`, data),
  delete: (id: string) =>
    apiCall<unknown>("DELETE", `/attendance/${id}`),
  sync: (force = false) =>
    apiCall<unknown>("POST", "/attendance/sync", { force }),
};

// ERP endpoints
export const erpAPI = {
  connect: (credentials: unknown) =>
    apiCall<unknown>("POST", "/erp/connect", credentials),
  sync: () => apiCall<unknown>("POST", "/erp/sync", {}),
  disconnect: () =>
    apiCall<unknown>("POST", "/erp/disconnect", {}),
  getStatus: () =>
    apiCall<unknown>("GET", "/erp/status"),
};

// Import endpoints
export const importAPI = {
  fromCSV: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<ApiResponse<unknown>>("/import/csv", formData);
  },
  fromImage: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post<ApiResponse<unknown>>("/import/image", formData);
  },
};

export default api;

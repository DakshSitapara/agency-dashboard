import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { AuthUser } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// The access token lives only in memory (a module-level variable), never in
// localStorage/sessionStorage - that would be readable by any injected script
// (XSS). The refresh token lives exclusively in the HttpOnly cookie the
// backend sets, which JS on this page can never read either.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // sends the HttpOnly refresh cookie automatically
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RefreshSession {
  accessToken: string;
  user: AuthUser;
}

let refreshPromise: Promise<RefreshSession | null> | null = null;

async function refreshSession(): Promise<RefreshSession | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const session = res.data.data as RefreshSession;
        setAccessToken(session.accessToken);
        return session;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function refreshAccessToken(): Promise<string | null> {
  const session = await refreshSession();
  return session?.accessToken ?? null;
}

export async function restoreSession(): Promise<RefreshSession | null> {
  return refreshSession();
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export { API_URL };

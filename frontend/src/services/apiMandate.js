import axios from "axios";
import api from "./apiInstance";
import { getApiBaseUrl } from "../utils/config";

// Instance publique sans token d'authentification
const publicApi = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 30000,
});

publicApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    return Promise.reject({
      status: error.response?.status,
      message: error.response?.data?.message || "Une erreur est survenue",
    });
  },
);

// Routes publiques (sans auth)
export const getMandateData = (token) =>
  publicApi.get(`/public/mandate/${token}`);

export const submitMandate = (token, data) =>
  publicApi.post(`/public/mandate/${token}`, data);

// Route authentifiée (interne CRM)
export const generateMandateLink = (partnerId) =>
  api.post(`/partners/${partnerId}/mandate`);

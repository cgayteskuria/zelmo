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

// Intercepteur de réponse pour normaliser les erreurs
publicApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    return Promise.reject({
      status: error.response?.status,
      message:
        error.response?.data?.message ||
        "Une erreur est survenue",
    });
  },
);

export const getSigningData = (token) =>
  publicApi.get(`/public/sign/${token}`);

export const submitSignature = (token, data) =>
  publicApi.post(`/public/sign/${token}`, data);

export const sendSignatureRequest = (docType, id, data) =>
  api.post(`/${docType}/${id}/send-signature-request`, data);

export const prepareSignatureToken = (docType, id) =>
  api.post(`/${docType}/${id}/prepare-signature`);

export const storeSignerEmail = (docType, id, signerEmail) =>
  api.patch(`/${docType}/${id}/signature-signer-email`, { signer_email: signerEmail });

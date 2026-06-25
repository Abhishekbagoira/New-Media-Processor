import axios from "axios";

const client = axios.create({
  baseURL: "new-media-processor-production.up.railway.app",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  get: (url) => client.get(url),
  post: (url, data) => client.post(url, data),
  postForm: (url, data) =>
    client.post(url, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

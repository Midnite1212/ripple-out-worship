import axios, { AxiosInstance } from 'axios';

export let customAxios: AxiosInstance;

export const updateAxiosClient = (token?: string) => {
  customAxios = axios.create(token ? { headers: { Authorization: `Bearer ${token}` } } : {});
};

updateAxiosClient();

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const TOKEN = fs.readFileSync('/tmp/token.txt', 'utf8').trim();
const BASE = 'http://localhost:8080/api';

async function testUpload() {
  console.log('Token:', TOKEN ? TOKEN.substring(0, 20) + '...' : '无');
  const api = axios.create({ baseURL: BASE, timeout: 30000 });
  api.interceptors.request.use((config) => {
    if (!config.headers) config.headers = {};
    config.headers.Authorization = 'Bearer ' + TOKEN;
    return config;
  });
  api.interceptors.response.use(
    (response) => {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'code' in data && data.code !== 0) {
        return Promise.reject(new Error(data.message || '请求失败'));
      }
      return response;
    },
    (error) => Promise.reject(new Error(error.response?.data?.message || error.message)),
  );

  const form = new FormData();
  form.append('file', fs.createReadStream('/tmp/test1.png'), { filename: 'test1.png', contentType: 'image/png' });
  const resp = await api.post('/upload', form, { timeout: 120000 });
  console.log('HTTP status:', resp.status);
  console.log('resp.data type:', typeof resp.data);
  console.log('resp.data:', JSON.stringify(resp.data).substring(0, 500));
  const inner = resp.data?.data;
  console.log('inner data:', inner);
  if (!inner?.url) {
    console.error('❌ 没拿到 url！axios 响应结构错误');
    console.error('resp.config.url:', resp.config.url);
    console.error('resp.request 最终URL（若有）:', resp.request?.res?.responseUrl || 'N/A');
    process.exit(1);
  }
  console.log('✅ 上传成功, URL=', inner.url);
}

testUpload().catch(e => { console.error('失败:', e.message); process.exit(2) });

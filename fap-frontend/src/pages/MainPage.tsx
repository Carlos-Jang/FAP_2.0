// src/pages/MainPage.tsx
import { useNavigate } from 'react-router-dom'
import './MainPage.css'
import { useEffect, useState } from 'react';
import Layout from './Layout';
import React from 'react';

const TABS = [
  { label: 'Main', key: 'main' },
  { label: 'AE Report', key: 'ae-report' },
  { label: 'AE Issues', key: 'ae-issues' },
];

const sampleProjects = [
  { id: 1, name: 'ATI PMS 개선' },
  { id: 2, name: 'Redmine 연동' },
  { id: 3, name: 'FAP 2.0 UI 리뉴얼' },
  { id: 4, name: 'AE Report 자동화' },
];

export default function MainPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState('main');

  useEffect(() => {
    // 로그인 시 localStorage에 저장된 아이디를 불러옴
    const id = localStorage.getItem('fap_user_id') || '';
    setUserId(id);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fap_logged_in');
    localStorage.removeItem('fap_user_id');
    navigate('/login');
  };

  return (
    <Layout>
      <div />
    </Layout>
  );
}

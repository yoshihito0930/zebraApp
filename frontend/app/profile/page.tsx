"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Input from '../../components/ui/input';
import Button from '../../components/ui/button';
import { useAuth } from '../../contexts/auth-context';

export default function ProfilePage() {
  const { user, updateProfile, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPasswordSection, setIsPasswordSection] = useState(false);
  
  // ユーザー情報が取得できたらフォームに設定
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.fullName || '',
        address: user.address || '',
        phone: user.phone || '',
      }));
    }
  }, [user]);
  
  // 未認証の場合はリダイレクト
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    try {
      const { currentPassword, newPassword, confirmPassword, ...profileData } = formData;
      
      await updateProfile(profileData);
      setMessage({
        type: 'success',
        text: 'プロフィールを更新しました。'
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '更新中にエラーが発生しました。'
      });
    }
  };
  
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    const { currentPassword, newPassword, confirmPassword } = formData;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({
        type: 'error',
        text: '現在のパスワードと新しいパスワードを入力してください。'
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage({
        type: 'error',
        text: '新しいパスワードが一致しません。'
      });
      return;
    }
    
    if (newPassword.length < 8) {
      setMessage({
        type: 'error',
        text: '新しいパスワードは8文字以上である必要があります。'
      });
      return;
    }
    
    try {
      await updateProfile({ currentPassword, newPassword });
      setMessage({
        type: 'success',
        text: 'パスワードを更新しました。'
      });
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'パスワード更新中にエラーが発生しました。'
      });
    }
  };
  
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">プロフィール設定</h1>
        
        {message && (
          <div className={`p-4 rounded mb-6 ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-500 text-green-700' 
              : 'bg-red-50 border border-accent text-accent'
          }`}>
            {message.text}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-separator">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-gray-800">
                {isPasswordSection ? 'パスワード変更' : 'プロフィール情報'}
              </h2>
              <Button 
                variant="secondary"
                onClick={() => setIsPasswordSection(!isPasswordSection)}
              >
                {isPasswordSection ? 'プロフィール情報に戻る' : 'パスワード変更'}
              </Button>
            </div>
          </div>
          
          <div className="p-6">
            {isPasswordSection ? (
              <form onSubmit={handlePasswordUpdate}>
                <Input
                  label="現在のパスワード"
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  required
                />
                
                <Input
                  label="新しいパスワード"
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  placeholder="8文字以上のパスワード"
                />
                
                <Input
                  label="新しいパスワード（確認用）"
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="新しいパスワードを再入力"
                />
                
                <div className="mt-6">
                  <Button
                    type="submit"
                    isLoading={isLoading}
                  >
                    パスワードを更新
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleProfileUpdate}>
                <Input
                  label="氏名"
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
                
                <Input
                  label="住所"
                  id="address"
                  name="address"
                  type="text"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="東京都新宿区○○..."
                />
                
                <Input
                  label="電話番号"
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="例: 090-1234-5678"
                />
                
                <div className="mt-6">
                  <Button
                    type="submit"
                    isLoading={isLoading}
                  >
                    プロフィールを更新
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

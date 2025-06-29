"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '../../../components/ui/input';
import Button from '../../../components/ui/button';
import { useAuth } from '../../../contexts/auth-context';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    address: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const { register, isLoading } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 基本的なバリデーション
    const { email, password, confirmPassword, fullName } = formData;
    
    if (!email || !password || !confirmPassword || !fullName) {
      setError('メールアドレス、パスワード、氏名は必須項目です。');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }
    
    if (password.length < 8) {
      setError('パスワードは8文字以上である必要があります。');
      return;
    }
    
    try {
      // パスワード確認フィールドを送信データから除外
      const { confirmPassword: _, ...registerData } = formData;
      await register(registerData);
      // 登録後の処理はuseAuth内のregister関数で行う
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('登録中にエラーが発生しました。');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">アカウント登録</h1>
          <p className="text-sm text-gray-600 mt-2">予約システムを利用するためのアカウントを作成</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-accent text-accent px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <Input
            label="メールアドレス"
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="example@example.com"
          />
          
          <Input
            label="氏名"
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange}
            required
            placeholder="山田 太郎"
          />
          
          <Input
            label="パスワード"
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="8文字以上のパスワード"
          />
          
          <Input
            label="パスワード（確認用）"
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            placeholder="パスワードを再入力"
          />
          
          <Input
            label="住所（任意）"
            id="address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
            placeholder="東京都新宿区○○..."
          />
          
          <Input
            label="電話番号（任意）"
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
              className="w-full"
            >
              登録する
            </Button>
          </div>
        </form>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            すでにアカウントをお持ちの方は 
            <Link href="/login" className="text-primary hover:underline">
              ログイン
            </Link>
            してください。
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '../../../components/ui/input';
import Button from '../../../components/ui/button';
import { useAuth } from '../../../contexts/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }
    
    try {
      await login(email, password);
      // ログイン後の処理はuseAuth内のlogin関数で行う
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('ログイン中にエラーが発生しました。');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">撮影スタジオ予約システム</h1>
          <p className="text-sm text-gray-600 mt-2">アカウントにログインしてください</p>
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
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="example@example.com"
          />
          
          <Input
            label="パスワード"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="パスワードを入力"
          />
          
          <div className="text-right mb-4">
            <Link 
              href="/forgot-password" 
              className="text-sm text-primary hover:underline"
            >
              パスワードをお忘れですか？
            </Link>
          </div>
          
          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full"
          >
            ログイン
          </Button>
        </form>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            アカウントをお持ちでない方は 
            <Link href="/register" className="text-primary hover:underline">
              登録
            </Link>
            してください。
          </p>
        </div>
      </div>
    </div>
  );
}

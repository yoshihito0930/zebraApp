"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Input from '../../../components/ui/input';
import Button from '../../../components/ui/button';
import { useAuth } from '../../../contexts/auth-context';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('メールアドレスを入力してください。');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await resetPassword(email);
      setIsSubmitted(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('パスワードリセットリクエスト中にエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">パスワードをお忘れですか？</h1>
          <p className="text-sm text-gray-600 mt-2">
            アカウントに登録したメールアドレスを入力してください
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-accent text-accent px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        
        {isSubmitted ? (
          <div className="text-center">
            <div className="bg-green-50 border border-green-500 text-green-700 px-4 py-6 rounded mb-6">
              <p className="font-medium">パスワードリセットの手順を送信しました</p>
              <p className="mt-2">
                {email} 宛にパスワードリセットのメールを送信しました。<br />
                メールに記載されたリンクをクリックして、新しいパスワードを設定してください。
              </p>
            </div>
            <Link 
              href="/login" 
              className="text-primary hover:underline"
            >
              ログイン画面に戻る
            </Link>
          </div>
        ) : (
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
            
            <div className="mt-6">
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full"
              >
                パスワードリセットリンクを送信
              </Button>
            </div>
          </form>
        )}
        
        <div className="text-center mt-6">
          <Link 
            href="/login" 
            className="text-primary hover:underline text-sm"
          >
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24">
      <div className="max-w-5xl w-full">
        <h1 className="text-4xl font-bold text-primary mb-8 text-center">
          撮影スタジオ予約管理システム
        </h1>
        
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">ようこそ</h2>
          <p className="mb-4">
            このシステムでは、撮影スタジオの予約管理を効率的に行うことができます。
            スタジオの空き状況確認から予約申請、管理までをオンラインで簡単に行えます。
          </p>
          
          <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
            <button className="btn-primary">ログイン</button>
            <button className="btn-secondary">新規登録</button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-medium mb-3 text-primary">スタジオ予約</h3>
            <p>カレンダーから空き状況を確認し、オンラインで予約申請が可能です。</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-medium mb-3 text-primary">予約管理</h3>
            <p>あなたの予約履歴や状況をいつでも確認できます。</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-medium mb-3 text-primary">通知機能</h3>
            <p>予約状況の変更や確認事項を自動通知でお知らせします。</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-xl font-medium mb-3 text-primary">オプションサービス</h3>
            <p>撮影に必要な機材やサービスを予約時に追加できます。</p>
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
}

interface BookingOption {
  id: string;
  name: string;
  price: number;
}

interface AdminBookingCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminBookingCreateModal({
  isOpen,
  onClose,
  onSuccess
}: AdminBookingCreateModalProps) {
  const [step, setStep] = useState<'user' | 'datetime' | 'details'>('user');
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const [formData, setFormData] = useState({
    // ユーザー情報
    userId: '',
    userEmail: '',
    userName: '',
    userPhone: '',
    
    // 日時情報
    startTime: '',
    endTime: '',
    
    // 予約詳細
    bookingType: 'confirmed' as 'temporary' | 'confirmed',
    purpose: '',
    notes: '',
    status: 'approved' as 'pending' | 'approved',
    optionIds: [] as string[]
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [availableOptions, setAvailableOptions] = useState<BookingOption[]>([]);

  useEffect(() => {
    if (isOpen) {
      // モーダルが開いた時の初期化
      setStep('user');
      setFormData({
        userId: '',
        userEmail: '',
        userName: '',
        userPhone: '',
        startTime: '',
        endTime: '',
        bookingType: 'confirmed',
        purpose: '',
        notes: '',
        status: 'approved',
        optionIds: []
      });
      setSelectedUser(null);
      setIsNewUser(false);
      setUserSearch('');
      setSearchResults([]);
      setErrors({});
      
      // オプション一覧の取得
      fetchOptions();
    }
  }, [isOpen]);

  const fetchOptions = async () => {
    try {
      // TODO: 実際のAPIエンドポイントに接続
      const mockOptions: BookingOption[] = [
        { id: '1', name: '追加照明', price: 3000 },
        { id: '2', name: '衣装レンタル', price: 5000 },
        { id: '3', name: 'メイクサービス', price: 8000 },
        { id: '4', name: 'データ追加納品', price: 2000 }
      ];
      setAvailableOptions(mockOptions);
    } catch (err) {
      console.error('オプション取得エラー:', err);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
      
      // 仮のデータ
      const mockUsers: User[] = [
        {
          id: 'user1',
          email: 'tanaka@example.com',
          fullName: '田中太郎',
          phone: '090-1234-5678'
        },
        {
          id: 'user2',
          email: 'sato@example.com',
          fullName: '佐藤花子',
          phone: '090-2345-6789'
        }
      ].filter(user => 
        user.fullName.includes(query) || 
        user.email.includes(query)
      );

      setSearchResults(mockUsers);
    } catch (err) {
      console.error('ユーザー検索エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSearch = (query: string) => {
    setUserSearch(query);
    searchUsers(query);
  };

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setFormData(prev => ({
      ...prev,
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      userPhone: user.phone || ''
    }));
    setUserSearch(user.fullName);
    setSearchResults([]);
  };

  const handleNewUser = () => {
    setIsNewUser(true);
    setSelectedUser(null);
    setUserSearch('');
    setSearchResults([]);
    setFormData(prev => ({
      ...prev,
      userId: '',
      userEmail: '',
      userName: '',
      userPhone: ''
    }));
  };

  const validateStep = (currentStep: string): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (currentStep === 'user') {
      if (isNewUser) {
        if (!formData.userEmail) newErrors.userEmail = 'メールアドレスは必須です';
        if (!formData.userName) newErrors.userName = '氏名は必須です';
        
        // メールアドレスの形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.userEmail && !emailRegex.test(formData.userEmail)) {
          newErrors.userEmail = 'メールアドレスの形式が正しくありません';
        }
      } else {
        if (!selectedUser) newErrors.user = 'ユーザーを選択してください';
      }
    }

    if (currentStep === 'datetime') {
      if (!formData.startTime) newErrors.startTime = '開始時間は必須です';
      if (!formData.endTime) newErrors.endTime = '終了時間は必須です';
      
      if (formData.startTime && formData.endTime) {
        const start = new Date(formData.startTime);
        const end = new Date(formData.endTime);
        if (end <= start) {
          newErrors.endTime = '終了時間は開始時間より後である必要があります';
        }
      }
    }

    if (currentStep === 'details') {
      if (!formData.purpose.trim()) newErrors.purpose = '撮影目的は必須です';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;

    if (step === 'user') {
      setStep('datetime');
    } else if (step === 'datetime') {
      setStep('details');
    }
  };

  const prevStep = () => {
    if (step === 'datetime') {
      setStep('user');
    } else if (step === 'details') {
      setStep('datetime');
    }
  };

  const handleSubmit = async () => {
    if (!validateStep('details')) return;

    try {
      setLoading(true);

      const requestData = {
        userId: isNewUser ? undefined : formData.userId,
        userEmail: isNewUser ? formData.userEmail : undefined,
        userName: isNewUser ? formData.userName : undefined,
        userPhone: isNewUser ? formData.userPhone : undefined,
        startTime: formData.startTime,
        endTime: formData.endTime,
        bookingType: formData.bookingType,
        purpose: formData.purpose,
        notes: formData.notes,
        status: formData.status,
        optionIds: formData.optionIds
      };

      // TODO: 実際のAPIエンドポイントに接続
      // const response = await fetch('/api/admin/bookings', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(requestData)
      // });

      console.log('予約作成:', requestData);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('予約作成エラー:', err);
      setErrors({ submit: '予約の作成に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPrice = () => {
    return formData.optionIds.reduce((total, optionId) => {
      const option = availableOptions.find(opt => opt.id === optionId);
      return total + (option?.price || 0);
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              新規予約作成
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ステップインジケーター */}
          <div className="mt-4">
            <div className="flex items-center">
              <div className={`flex items-center ${step === 'user' ? 'text-blue-600' : 'text-green-600'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  step === 'user' ? 'border-blue-600 bg-blue-50' : 'border-green-600 bg-green-50'
                }`}>
                  {step === 'user' ? '1' : '✓'}
                </div>
                <span className="ml-2 text-sm font-medium">ユーザー選択</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300 mx-4"></div>
              <div className={`flex items-center ${
                step === 'datetime' ? 'text-blue-600' : 
                step === 'details' ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  step === 'datetime' ? 'border-blue-600 bg-blue-50' : 
                  step === 'details' ? 'border-green-600 bg-green-50' : 'border-gray-300'
                }`}>
                  {step === 'details' ? '✓' : '2'}
                </div>
                <span className="ml-2 text-sm font-medium">日時選択</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300 mx-4"></div>
              <div className={`flex items-center ${step === 'details' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  step === 'details' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
                }`}>
                  3
                </div>
                <span className="ml-2 text-sm font-medium">詳細設定</span>
              </div>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* ステップ1: ユーザー選択 */}
          {step === 'user' && (
            <div className="space-y-6">
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={() => {
                    setIsNewUser(false);
                    setSelectedUser(null);
                    setUserSearch('');
                  }}
                  className={`px-4 py-2 rounded-md ${
                    !isNewUser ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  既存ユーザー
                </button>
                <button
                  onClick={handleNewUser}
                  className={`px-4 py-2 rounded-md ${
                    isNewUser ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  新規ユーザー
                </button>
              </div>

              {!isNewUser ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ユーザー検索
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      placeholder="名前またはメールアドレスで検索"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => selectUser(user)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{user.fullName}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedUser && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-md">
                      <h4 className="font-medium text-blue-900">選択されたユーザー</h4>
                      <p className="text-blue-700">{selectedUser.fullName}</p>
                      <p className="text-blue-600 text-sm">{selectedUser.email}</p>
                    </div>
                  )}
                  {errors.user && (
                    <p className="text-red-600 text-sm mt-1">{errors.user}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      氏名 *
                    </label>
                    <input
                      type="text"
                      value={formData.userName}
                      onChange={(e) => setFormData(prev => ({ ...prev, userName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.userName && (
                      <p className="text-red-600 text-sm mt-1">{errors.userName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス *
                    </label>
                    <input
                      type="email"
                      value={formData.userEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, userEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.userEmail && (
                      <p className="text-red-600 text-sm mt-1">{errors.userEmail}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      電話番号
                    </label>
                    <input
                      type="tel"
                      value={formData.userPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, userPhone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ステップ2: 日時選択 */}
          {step === 'datetime' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">日時選択</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        開始時間 *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.startTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {errors.startTime && (
                        <p className="text-red-600 text-sm mt-1">{errors.startTime}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        終了時間 *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.endTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {errors.endTime && (
                        <p className="text-red-600 text-sm mt-1">{errors.endTime}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">カレンダープレビュー</h3>
                  <div className="h-64 border border-gray-300 rounded-md">
                    {/* TODO: カレンダーコンポーネントの統合 */}
                    <div className="h-full flex items-center justify-center text-gray-500">
                      カレンダープレビュー
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ステップ3: 詳細設定 */}
          {step === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      予約タイプ
                    </label>
                    <select
                      value={formData.bookingType}
                      onChange={(e) => setFormData(prev => ({ ...prev, bookingType: e.target.value as 'temporary' | 'confirmed' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="confirmed">本予約</option>
                      <option value="temporary">仮予約</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      初期ステータス
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'pending' | 'approved' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="approved">承認済み</option>
                      <option value="pending">承認待ち</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      撮影目的 *
                    </label>
                    <input
                      type="text"
                      value={formData.purpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                      placeholder="例: ポートレート撮影"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.purpose && (
                      <p className="text-red-600 text-sm mt-1">{errors.purpose}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      備考・メモ
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">オプション選択</h3>
                  <div className="space-y-2">
                    {availableOptions.map((option) => (
                      <label key={option.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.optionIds.includes(option.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                optionIds: [...prev.optionIds, option.id]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                optionIds: prev.optionIds.filter(id => id !== option.id)
                              }));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {option.name} (+{option.price.toLocaleString()}円)
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <h4 className="font-medium text-gray-900">料金合計</h4>
                    <p className="text-lg font-semibold text-blue-600">
                      {calculateTotalPrice().toLocaleString()}円
                    </p>
                  </div>
                </div>
              </div>

              {errors.submit && (
                <div className="p-4 bg-red-50 rounded-md">
                  <p className="text-red-600 text-sm">{errors.submit}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div>
            {step !== 'user' && (
              <button
                onClick={prevStep}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                戻る
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
            {step !== 'details' ? (
              <button
                onClick={nextStep}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                次へ
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '作成中...' : '予約作成'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

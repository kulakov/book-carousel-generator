'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.includes('ridero.ru/books/')) {
      setError('Введите корректную ссылку на книгу в Ridero');
      return;
    }

    if (!coverFile) {
      setError('Загрузите обложку книги');
      return;
    }

    setLoading(true);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('url', url);
      formData.append('cover', coverFile);

      // Send to API
      const response = await fetch('/api/project/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Ошибка создания проекта');
      }

      const data = await response.json();
      router.push(`/project/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl font-bold mb-3 tracking-tight">
            Book Carousel
          </h1>
          <p className="text-neutral-400 text-lg">
            Генератор каруселей для маркетплейсов
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-2">
              Ссылка на книгу в Ridero
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ridero.ru/books/..."
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:border-red-600 transition-colors text-white placeholder-neutral-500"
              required
            />
          </div>

          {/* Cover Upload */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Обложка книги
            </label>
            <div className="flex gap-4">
              {/* Upload area */}
              <label className="flex-1 cursor-pointer">
                <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  coverPreview
                    ? 'border-green-600 bg-green-950/20'
                    : 'border-neutral-700 hover:border-neutral-600'
                }`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                  />
                  {coverPreview ? (
                    <span className="text-green-500">Обложка загружена</span>
                  ) : (
                    <>
                      <div className="text-neutral-400 mb-1">
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Нажмите для загрузки
                      </div>
                      <span className="text-neutral-500 text-sm">PNG, JPG до 5MB</span>
                    </>
                  )}
                </div>
              </label>

              {/* Preview */}
              {coverPreview && (
                <div className="w-24 h-32 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Анализируем...
              </>
            ) : (
              'Создать карусель'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-neutral-600 text-sm mt-8">
          Генерация занимает 1-2 минуты
        </p>
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Project, SlideContent } from '@/lib/types';
import { toPng } from 'html-to-image';

// Default slide templates
const defaultSlides: SlideContent[] = [
  {
    type: 'hook',
    headline: 'БЕССМЕРТИЕ — ЭТО НЕ ДАР',
    subheadline: 'Фантастическая повесть',
  },
  {
    type: 'audience',
    headline: 'ЭТА КНИГА ДЛЯ ВАС, ЕСЛИ:',
    bullets: [
      'Любите антиутопии и философскую фантастику',
      'Цените короткие, но глубокие тексты',
      'Задаётесь вопросами о смысле жизни',
      'Хотите свежий взгляд на тему',
    ],
  },
  {
    type: 'about',
    headline: 'О ЧЁМ ЭТА КНИГА',
    subheadline: 'Описание сюжета без спойлеров...',
  },
  {
    type: 'author',
    headline: 'ОБ АВТОРЕ',
    subheadline: 'Имя Автора',
    bullets: ['Достижение 1', 'Достижение 2', 'Достижение 3'],
    quote: 'Цитата автора о книге',
  },
  {
    type: 'specs',
    bullets: ['4.8 ★ рейтинг', '200 страниц', '16+', 'Электронная + печатная'],
  },
  {
    type: 'cta',
    headline: 'ГОТОВЫ НАЧАТЬ?',
    subheadline: 'В корзину',
  },
];

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSlide, setGeneratingSlide] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/project/${id}`);
      if (!response.ok) throw new Error('Project not found');

      const data = await response.json();

      // Initialize slides if empty
      if (!data.slides || data.slides.length === 0) {
        data.slides = defaultSlides.map((slide) => ({
          ...slide,
          headline:
            slide.type === 'hook'
              ? data.bookData?.title?.toUpperCase() || slide.headline
              : slide.headline,
          subheadline:
            slide.type === 'author'
              ? data.bookData?.author || slide.subheadline
              : slide.type === 'about'
              ? data.bookData?.description?.slice(0, 200) || slide.subheadline
              : slide.subheadline,
        }));
      }

      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading project');
    } finally {
      setLoading(false);
    }
  };

  const updateSlide = async (index: number, updates: Partial<SlideContent>) => {
    if (!project) return;

    const newSlides = [...project.slides];
    newSlides[index] = { ...newSlides[index], ...updates };

    setProject({ ...project, slides: newSlides });

    // Auto-save
    setSaving(true);
    try {
      await fetch(`/api/project/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: newSlides }),
      });
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const generateBackgrounds = async () => {
    if (!project) return;

    setGenerating(true);
    setError(null);

    try {
      // Fetch cover image as base64
      const coverResponse = await fetch(project.coverUrl);
      const coverBlob = await coverResponse.blob();
      const coverBase64 = await blobToBase64(coverBlob);

      // Generate backgrounds for each slide
      const updatedSlides = [...project.slides];

      for (let i = 0; i < project.slides.length; i++) {
        setGeneratingSlide(i);
        const slide = project.slides[i];

        try {
          // Use local generation in development, serverless in production
          const apiEndpoint = process.env.NODE_ENV === 'development'
            ? '/api/generate-local'
            : '/api/generate';

          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slideType: slide.type,
              coverData: coverBase64.split(',')[1], // Remove data:image/png;base64, prefix
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.imageData) {
              updatedSlides[i] = {
                ...updatedSlides[i],
                backgroundUrl: `data:image/png;base64,${data.imageData}`,
              };
            }
          }
        } catch (err) {
          console.error(`Error generating slide ${i}:`, err);
        }
      }

      // Save updated slides
      setProject({ ...project, slides: updatedSlides, status: 'ready' });
      await fetch(`/api/project/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: updatedSlides, status: 'ready' }),
      });

      setGeneratingSlide(null);
    } catch (err) {
      setError('Ошибка генерации подложек');
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const exportToPNG = async () => {
    if (!slideRef.current || !project) return;

    setExporting(true);

    try {
      // Export each slide
      for (let i = 0; i < project.slides.length; i++) {
        setActiveSlide(i);

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate PNG
        const dataUrl = await toPng(slideRef.current, {
          width: 1080,
          height: 1350,
          pixelRatio: 2,
        });

        // Download
        const link = document.createElement('a');
        link.download = `${project.bookData?.title || 'carousel'}_${i + 1}.png`;
        link.href = dataUrl;
        link.click();

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (err) {
      console.error('Export error:', err);
      setError('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Project not found'}</div>
      </div>
    );
  }

  const currentSlide = project.slides[activeSlide];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">
            {project.bookData?.title || 'Карусель'}
          </h1>
          <p className="text-neutral-500 text-sm">
            {project.bookData?.author}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saving && (
            <span className="text-neutral-500 text-sm">Сохранение...</span>
          )}
          {generating && generatingSlide !== null && (
            <span className="text-neutral-500 text-sm">
              Генерация {generatingSlide + 1}/6...
            </span>
          )}
          {project.status === 'draft' && (
            <button
              onClick={generateBackgrounds}
              disabled={generating}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              {generating ? 'Генерация...' : 'Генерировать карусель'}
            </button>
          )}
          <button
            onClick={exportToPNG}
            disabled={exporting || project.status === 'draft'}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {exporting ? 'Экспорт...' : 'Экспорт PNG'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Slide Navigation */}
        <aside className="w-48 border-r border-neutral-800 p-4 space-y-2">
          {project.slides.map((slide, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSlide === index
                  ? 'bg-red-600 text-white'
                  : 'hover:bg-neutral-800 text-neutral-400'
              }`}
            >
              {index + 1}. {getSlideLabel(slide.type)}
            </button>
          ))}
        </aside>

        {/* Main Preview */}
        <main className="flex-1 p-8 flex items-center justify-center">
          <div ref={slideRef} className="slide-frame bg-neutral-900 rounded-lg overflow-hidden relative" style={{ width: '540px', height: '675px' }}>
            {/* Background - use generated background or cover as fallback */}
            {currentSlide.backgroundUrl ? (
              <img
                src={currentSlide.backgroundUrl}
                alt="Slide background"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={project.coverUrl}
                alt="Cover"
                className="absolute inset-0 w-full h-full object-cover opacity-20"
              />
            )}

            {/* Content overlay */}
            <div className="relative z-10 h-full p-6 flex flex-col">
              {currentSlide.type === 'hook' && (
                <HookSlide
                  slide={currentSlide}
                  onUpdate={(updates) => updateSlide(activeSlide, updates)}
                />
              )}
              {currentSlide.type === 'audience' && (
                <AudienceSlide
                  slide={currentSlide}
                  onUpdate={(updates) => updateSlide(activeSlide, updates)}
                />
              )}
              {currentSlide.type === 'about' && (
                <AboutSlide
                  slide={currentSlide}
                  onUpdate={(updates) => updateSlide(activeSlide, updates)}
                />
              )}
              {currentSlide.type === 'author' && (
                <AuthorSlide
                  slide={currentSlide}
                  onUpdate={(updates) => updateSlide(activeSlide, updates)}
                />
              )}
              {currentSlide.type === 'specs' && (
                <SpecsSlide
                  slide={currentSlide}
                  onUpdate={(updates) => updateSlide(activeSlide, updates)}
                />
              )}
              {currentSlide.type === 'cta' && (
                <CtaSlide
                  slide={currentSlide}
                  onUpdate={(updates) => updateSlide(activeSlide, updates)}
                />
              )}
            </div>
          </div>
        </main>

        {/* Properties Panel */}
        <aside className="w-64 border-l border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-400 mb-4">
            Свойства
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Шрифт заголовков
              </label>
              <select
                value={project.fonts.headline}
                onChange={(e) =>
                  setProject({
                    ...project,
                    fonts: { ...project.fonts, headline: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm"
              >
                <option value="Oswald">Oswald</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Playfair Display">Playfair Display</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                Шрифт текста
              </label>
              <select
                value={project.fonts.body}
                onChange={(e) =>
                  setProject({
                    ...project,
                    fonts: { ...project.fonts, body: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm"
              >
                <option value="Inter">Inter</option>
                <option value="PT Sans">PT Sans</option>
                <option value="Lora">Lora</option>
              </select>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function getSlideLabel(type: string): string {
  const labels: Record<string, string> = {
    hook: 'Захват',
    audience: 'Для кого',
    about: 'О чём',
    author: 'Автор',
    specs: 'Характеристики',
    cta: 'Призыв',
  };
  return labels[type] || type;
}

// Slide Components
interface SlideProps {
  slide: SlideContent;
  onUpdate: (updates: Partial<SlideContent>) => void;
}

function HookSlide({ slide, onUpdate }: SlideProps) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center text-center">
      <h2
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ headline: e.currentTarget.textContent || '' })}
        className="font-display text-3xl font-bold leading-tight"
      >
        {slide.headline}
      </h2>
      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ subheadline: e.currentTarget.textContent || '' })}
        className="mt-4 text-neutral-400"
      >
        {slide.subheadline}
      </p>
    </div>
  );
}

function AudienceSlide({ slide, onUpdate }: SlideProps) {
  return (
    <div className="flex-1 flex flex-col">
      <h2
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ headline: e.currentTarget.textContent || '' })}
        className="font-display text-xl font-bold mb-6"
      >
        {slide.headline}
      </h2>
      <div className="space-y-3">
        {slide.bullets?.map((bullet, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-red-500 mt-1">→</span>
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const newBullets = [...(slide.bullets || [])];
                newBullets[i] = e.currentTarget.textContent || '';
                onUpdate({ bullets: newBullets });
              }}
              className="text-sm"
            >
              {bullet}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutSlide({ slide, onUpdate }: SlideProps) {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <h2
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ headline: e.currentTarget.textContent || '' })}
        className="font-display text-xl font-bold mb-4"
      >
        {slide.headline}
      </h2>
      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ subheadline: e.currentTarget.textContent || '' })}
        className="text-sm text-neutral-300 leading-relaxed"
      >
        {slide.subheadline}
      </p>
    </div>
  );
}

function AuthorSlide({ slide, onUpdate }: SlideProps) {
  return (
    <div className="flex-1 flex flex-col">
      <h2
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ headline: e.currentTarget.textContent || '' })}
        className="font-display text-xl font-bold mb-2"
      >
        {slide.headline}
      </h2>
      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ subheadline: e.currentTarget.textContent || '' })}
        className="text-lg text-neutral-300 mb-4"
      >
        {slide.subheadline}
      </p>
      <div className="space-y-2 mb-4">
        {slide.bullets?.map((bullet, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-neutral-400">
            <span>→</span>
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const newBullets = [...(slide.bullets || [])];
                newBullets[i] = e.currentTarget.textContent || '';
                onUpdate({ bullets: newBullets });
              }}
            >
              {bullet}
            </span>
          </div>
        ))}
      </div>
      {slide.quote && (
        <blockquote
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ quote: e.currentTarget.textContent || '' })}
          className="italic text-sm text-neutral-500 border-l-2 border-red-600 pl-3"
        >
          "{slide.quote}"
        </blockquote>
      )}
    </div>
  );
}

function SpecsSlide({ slide, onUpdate }: SlideProps) {
  return (
    <div className="flex-1 flex flex-col justify-center space-y-4">
      {slide.bullets?.map((bullet, i) => (
        <div key={i} className="flex items-center gap-3 text-lg">
          <span className="w-8 h-8 bg-red-600/20 rounded-full flex items-center justify-center text-red-500">
            {i === 0 ? '★' : i === 1 ? '📄' : i === 2 ? '🔞' : '📱'}
          </span>
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              const newBullets = [...(slide.bullets || [])];
              newBullets[i] = e.currentTarget.textContent || '';
              onUpdate({ bullets: newBullets });
            }}
          >
            {bullet}
          </span>
        </div>
      ))}
    </div>
  );
}

function CtaSlide({ slide, onUpdate }: SlideProps) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center text-center">
      <h2
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate({ headline: e.currentTarget.textContent || '' })}
        className="font-display text-2xl font-bold mb-6"
      >
        {slide.headline}
      </h2>
      <div className="bg-red-600 px-8 py-3 rounded-lg">
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate({ subheadline: e.currentTarget.textContent || '' })}
          className="font-medium"
        >
          {slide.subheadline}
        </span>
      </div>
    </div>
  );
}

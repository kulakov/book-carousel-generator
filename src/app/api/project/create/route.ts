import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { parseRideroPage } from '@/lib/ridero';
import { Project } from '@/lib/types';
import { put } from '@vercel/blob';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Dual-mode storage: Vercel Blob (production) or local filesystem (development)
const isProduction = process.env.NODE_ENV === 'production';
const DATA_DIR = join(process.cwd(), 'data');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const url = formData.get('url') as string;
    const coverFile = formData.get('cover') as File;

    if (!url || !coverFile) {
      return NextResponse.json(
        { error: 'URL and cover are required' },
        { status: 400 }
      );
    }

    // Validate URL
    if (!url.includes('ridero.ru/books/')) {
      return NextResponse.json(
        { error: 'Invalid Ridero URL' },
        { status: 400 }
      );
    }

    // Generate project ID
    const id = uuidv4().slice(0, 8);

    // Convert file to buffer
    const coverBuffer = Buffer.from(await coverFile.arrayBuffer());

    let coverUrl: string;

    if (isProduction) {
      // Production: use Vercel Blob
      const coverBlob = await put(`covers/${id}.png`, coverBuffer, {
        access: 'public',
        contentType: coverFile.type,
      });
      coverUrl = coverBlob.url;
    } else {
      // Development: use local filesystem
      const coversDir = join(DATA_DIR, 'covers');
      await mkdir(coversDir, { recursive: true });

      const coverPath = join(coversDir, `${id}.png`);
      await writeFile(coverPath, coverBuffer);

      coverUrl = `/api/storage/covers/${id}.png`;
    }

    // Parse Ridero page
    let bookData;
    try {
      bookData = await parseRideroPage(url);
    } catch (error) {
      console.error('Failed to parse Ridero:', error);
      // Continue with empty book data - user can fill in manually
      bookData = {
        title: 'Новая книга',
        author: 'Автор',
        genre: 'Художественная литература',
        description: '',
        pages: 0,
        ageRating: '12+',
      };
    }

    // Create project
    const project: Project = {
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      rideroUrl: url,
      coverUrl,
      bookData,
      slides: [],
      fonts: {
        headline: 'Oswald',
        body: 'Inter',
      },
    };

    if (isProduction) {
      // Production: save to Vercel Blob
      await put(`projects/${id}.json`, JSON.stringify(project, null, 2), {
        access: 'public',
        contentType: 'application/json',
      });
    } else {
      // Development: save to local filesystem
      const projectsDir = join(DATA_DIR, 'projects');
      await mkdir(projectsDir, { recursive: true });

      const projectPath = join(projectsDir, `${id}.json`);
      await writeFile(projectPath, JSON.stringify(project, null, 2));
    }

    return NextResponse.json({ id, project });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

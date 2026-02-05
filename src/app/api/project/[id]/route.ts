import { NextRequest, NextResponse } from 'next/server';
import { Project } from '@/lib/types';
import { put } from '@vercel/blob';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const DATA_DIR = join(process.cwd(), 'data');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let project: Project;

    if (isProduction) {
      // Production: fetch from Vercel Blob
      const blobUrl = `https://blob.vercel-storage.com/projects/${id}.json`;
      const response = await fetch(blobUrl);

      if (!response.ok) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      project = await response.json();
    } else {
      // Development: read from local filesystem
      const projectPath = join(DATA_DIR, 'projects', `${id}.json`);
      const fileContent = await readFile(projectPath, 'utf-8');
      project = JSON.parse(fileContent);
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch existing project
    const getResponse = await fetch(`${request.url.split('/api')[0]}/api/project/${id}`);
    if (!getResponse.ok) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project: Project = await getResponse.json();

    // Merge updates
    const updates = await request.json();
    const updatedProject: Project = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (isProduction) {
      // Production: save to Vercel Blob
      await put(`projects/${id}.json`, JSON.stringify(updatedProject, null, 2), {
        access: 'public',
        contentType: 'application/json',
      });
    } else {
      // Development: save to local filesystem
      const projectPath = join(DATA_DIR, 'projects', `${id}.json`);
      await writeFile(projectPath, JSON.stringify(updatedProject, null, 2));
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

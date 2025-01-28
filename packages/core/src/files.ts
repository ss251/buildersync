import path from 'path';
import { IFileManager } from './types';
import fs from 'fs/promises';

export class FileManager implements IFileManager {
  rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  getPath(filePath: string): string {
    return path.join(this.rootDir, filePath);
  }

  async ls(path: string): Promise<{ filename: string }[]> {
    const stats = await fs.lstat(this.getPath(path));

    if (stats.isDirectory()) {
      const dir = await fs.readdir(this.getPath(path));
      return dir.map((t) => ({ filename: t }));
    }

    return [];
  }

  async read(filePath: string): Promise<string> {
    return await fs.readFile(this.getPath(filePath), 'utf8');
  }

  async readBytes(filePath: string): Promise<Buffer> {
    return await fs.readFile(this.getPath(filePath));
  }

  async write(filePath: string, data: string): Promise<void> {
    const fullFilePath = this.getPath(filePath);
    await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
    await fs.writeFile(fullFilePath, data, 'utf8');
  }

  async writeBytes(filePath: string, data: Buffer) {
    const fullFilePath = this.getPath(filePath);
    await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
    await fs.writeFile(fullFilePath, data);
  }

  async exists(filePath: string): Promise<boolean> {
    const stats = await fs.stat(this.getPath(filePath));
    return stats.isFile();
  }
}

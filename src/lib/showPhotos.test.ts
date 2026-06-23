import { describe, it, expect } from 'vitest';
import type { AthletePhoto } from '@/types';
import {
  cutoutPath,
  dataUrlToBlob,
  fromSharedPhoto,
  toSharedPhoto,
} from './showPhotos';

// 1×1 transparent PNG.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';

const photo: AthletePhoto = {
  imageUrl: PNG_DATA_URL,
  face: { x: 1, y: 2, width: 3, height: 4, imgW: 10, imgH: 20 },
  body: { x: 0, y: 0, width: 10, height: 20, imgW: 10, imgH: 20 },
  pose: { landmarks: [{ x: 0.1, y: 0.2, visibility: 0.9 }], imgW: 10, imgH: 20 },
  offsetX: 0.05,
  offsetY: -0.02,
};

describe('cutoutPath', () => {
  it('builds a deterministic per-pose, per-side path', () => {
    expect(cutoutPath('projectbb', 'FDB', 'A')).toBe('projectbb/FDB/A.png');
    expect(cutoutPath('projectbb', 'MM', 'B')).toBe('projectbb/MM/B.png');
  });
});

describe('dataUrlToBlob', () => {
  it('decodes a base64 data URL into a Blob of the declared type', () => {
    const blob = dataUrlToBlob(PNG_DATA_URL);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('shared photo mapping', () => {
  it('toSharedPhoto carries metadata + url, dropping the local imageUrl', () => {
    const shared = toSharedPhoto(photo, 'https://cdn/img.png?v=1');
    expect(shared.url).toBe('https://cdn/img.png?v=1');
    expect(shared).not.toHaveProperty('imageUrl');
    expect(shared.face).toEqual(photo.face);
    expect(shared.body).toEqual(photo.body);
    expect(shared.pose).toEqual(photo.pose);
    expect(shared.offsetX).toBe(0.05);
    expect(shared.offsetY).toBe(-0.02);
  });

  it('fromSharedPhoto round-trips back to a store photo using url as imageUrl', () => {
    const back = fromSharedPhoto(toSharedPhoto(photo, 'https://cdn/img.png?v=1'));
    expect(back.imageUrl).toBe('https://cdn/img.png?v=1');
    expect(back.face).toEqual(photo.face);
    expect(back.body).toEqual(photo.body);
    expect(back.pose).toEqual(photo.pose);
    expect(back.offsetX).toBe(0.05);
    expect(back.offsetY).toBe(-0.02);
  });
});

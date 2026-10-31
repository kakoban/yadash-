import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Entry } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const COLLECTION_NAME = 'entries';

// Blueprint validation constants
export const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_TITLE_LENGTH = 500;
export const MAX_BODY_LENGTH = 50000;
export const MAX_TAGS_COUNT = 20;
export const MAX_TAG_LENGTH = 100;
export const ALLOWED_TYPES: Entry['type'][] = [
  'note',
  'thought',
  'idea',
  'quote',
  'list',
  'link',
  'code',
];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeId(rawId: string): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, MAX_ID_LENGTH);
  return cleaned.length > 0 ? cleaned : `entry_${Date.now()}`;
}

function sanitizeEntryPayload(entry: Entry) {
  const safeId = sanitizeId(entry.id);
  const safeType: Entry['type'] = ALLOWED_TYPES.includes(entry.type) ? entry.type : 'note';
  const safeTitle = String(entry.title || '').slice(0, MAX_TITLE_LENGTH);
  const rawBody = String(entry.body || '').trim();
  const safeBody = (rawBody.length > 0 ? rawBody : '-').slice(0, MAX_BODY_LENGTH);
  const safeTags = (Array.isArray(entry.tags) ? entry.tags : [])
    .map((t) => String(t || '').trim().slice(0, MAX_TAG_LENGTH))
    .filter((t) => t.length > 0)
    .slice(0, MAX_TAGS_COUNT);
  const safePinned = Boolean(entry.pinned);
  const safeEntryTime = Math.max(1, Math.floor(Number(entry.createdAt) || Date.now()));

  return {
    id: safeId,
    type: safeType,
    title: safeTitle,
    body: safeBody,
    tags: safeTags,
    pinned: safePinned,
    entryTime: safeEntryTime,
  };
}

// Validate connection to Firestore on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on /test/connection still confirms online connectivity to Firestore
    return true;
  }
}

// Trigger initial boot connection check
testConnection();

export async function fetchAllEntries(): Promise<{ data: Entry[] | null; error: any }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { data: [], error: null };
  }

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', currentUser.uid)
    );
    const snapshot = await getDocs(q);
    const mappedData: Entry[] = snapshot.docs.map((docSnap) => {
      const row = docSnap.data();
      return {
        id: row.id || docSnap.id,
        type: ALLOWED_TYPES.includes(row.type) ? row.type : 'note',
        title: row.title || '',
        body: row.body || '',
        tags: Array.isArray(row.tags) ? row.tags : [],
        createdAt: Number(row.entryTime) || Date.now(),
        pinned: Boolean(row.pinned),
      };
    });

    mappedData.sort((a, b) => b.createdAt - a.createdAt);
    return { data: mappedData, error: null };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    } catch (formattedErr) {
      return { data: null, error: formattedErr };
    }
  }
}

export async function insertEntry(entry: Entry): Promise<{ error: any }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { error: new Error('User not authenticated') };
  }

  const sanitized = sanitizeEntryPayload(entry);
  const path = `${COLLECTION_NAME}/${sanitized.id}`;

  try {
    await setDoc(doc(db, COLLECTION_NAME, sanitized.id), {
      id: sanitized.id,
      userId: currentUser.uid,
      type: sanitized.type,
      title: sanitized.title,
      body: sanitized.body,
      tags: sanitized.tags,
      pinned: sanitized.pinned,
      entryTime: sanitized.entryTime,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch (formattedErr) {
      return { error: formattedErr };
    }
  }
}

export async function updateEntry(entry: Entry): Promise<{ error: any }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { error: new Error('User not authenticated') };
  }

  const sanitized = sanitizeEntryPayload(entry);
  const path = `${COLLECTION_NAME}/${sanitized.id}`;

  try {
    await updateDoc(doc(db, COLLECTION_NAME, sanitized.id), {
      type: sanitized.type,
      title: sanitized.title,
      body: sanitized.body,
      tags: sanitized.tags,
      pinned: sanitized.pinned,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (error: any) {
    // If document was only in local storage previously, create it
    if (error?.code === 'not-found') {
      return insertEntry(entry);
    }
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch (formattedErr) {
      return { error: formattedErr };
    }
  }
}

export async function deleteEntry(id: string): Promise<{ error: any }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { error: new Error('User not authenticated') };
  }

  const safeId = sanitizeId(id);
  const path = `${COLLECTION_NAME}/${safeId}`;

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, safeId));
    return { error: null };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch (formattedErr) {
      return { error: formattedErr };
    }
  }
}

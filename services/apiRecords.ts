
import { supabase, isConfigured } from './supabaseClient';
import { RecordFile } from '../types';
import { MOCK_RECORDS, API_BASE_URL } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, normalizeCode } from './apiCore';

const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo',
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 
    'measurementNumber', 'excerptNumber',
    'reminderDate', 'lastRemindedAt',
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection',
    'issueNumber', 'entryNumber', 'issueDate', 'residentialArea'
];

export const fetchRecords = async (): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình. Đang dùng dữ liệu Cache/Mock.");
      return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }

  try {
    let allRecords: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 1;

    while (hasMore) {
        try {
            const { data, error } = await supabase
                .from('land_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(from, from + step - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allRecords = [...allRecords, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        } catch (fetchError: any) {
            if (retryCount < maxRetries && (fetchError.message?.includes('fetch') || !fetchError.code)) {
                console.warn(`Lỗi fetchRecords, đang thử lại lần ${retryCount + 1}...`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; 
            }
            throw fetchError;
        }
    }
    
    const uniqueMap = new Map();
    allRecords.forEach((item: any) => {
        if (item.id) uniqueMap.set(item.id, item);
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    
    console.log(`[Fetch] Total fetched: ${uniqueRecords.length}`);
    saveToCache(CACHE_KEYS.RECORDS, uniqueRecords);
    return uniqueRecords as RecordFile[];

  } catch (error) {
    logError("fetchRecords", error);
    return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }
};

export const getShortCode = (ward: string) => {
    const normalized = ward.toLowerCase().trim();
    const cleanName = normalized
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

    if (cleanName.includes('tân khai') || cleanName.includes('tankhai')) return 'TK';
    if (cleanName.includes('tân hưng') || cleanName.includes('tanhung')) return 'TH';
    if (cleanName.includes('minh đức') || cleanName.includes('minhduc')) return 'MĐ';
    if (cleanName.includes('tân quan') || cleanName.includes('tanquan')) return 'TQ';

    if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
    if (cleanName.includes('chơn thành') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
    if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
    if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
    if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
    if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
    if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
    if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
    
    return 'CT';
};

export const getNextGlobalRecordCode = async (wardName: string, dateStr: string): Promise<string> => {
    const prefix = getShortCode(wardName);
    if (!isConfigured) {
        const d = new Date(dateStr);
        const yy = d.getFullYear().toString().slice(-2);
        const mm = ('0' + (d.getMonth() + 1)).slice(-2);
        const dd = ('0' + d.getDate()).slice(-2);
        return `${prefix}-${yy}${mm}${dd}-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    }

    const d = new Date(dateStr);
    const year = d.getFullYear().toString();
    const yy = year.slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    
    const key = `record_counter_${year}`;
    let nextSeq = 1;
    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
        attempts++;
        try {
            const { data } = await supabase.from('system_settings').select('value').eq('key', key).single();
            
            let currentVal = 0;
            if (data && data.value) {
                currentVal = parseInt(data.value, 10);
                if (isNaN(currentVal)) currentVal = 0;
            }

            nextSeq = currentVal + 1;

            if (data) {
                const { data: updatedData, error } = await supabase
                    .from('system_settings')
                    .update({ value: nextSeq.toString() })
                    .eq('key', key)
                    .eq('value', data.value)
                    .select();
                    
                if (!error && updatedData && updatedData.length > 0) {
                    success = true;
                }
            } else {
                const { data: insertedData, error } = await supabase
                    .from('system_settings')
                    .insert([{ key, value: nextSeq.toString() }])
                    .select();
                    
                if (!error && insertedData && insertedData.length > 0) {
                    success = true;
                }
            }
        } catch (e) {
            // Ignore and retry
        }

        if (!success) {
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
        }
    }

    const seqStr = nextSeq.toString().padStart(4, '0');
    return `${prefix}-${datePrefix}-${seqStr}`;
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        let finalCode = record.code;
        const isGeneratedFormat = finalCode && /^[A-ZĐ]{2,3}-\d{6}-\d{3,4}$/.test(finalCode);
        
        if (!finalCode || finalCode.includes('?') || isGeneratedFormat) {
            finalCode = await getNextGlobalRecordCode(record.ward || '', record.receivedDate || new Date().toISOString());
        }
        
        const payload = sanitizeData({ ...record, code: finalCode }, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('land_records').insert([payload]).select();
        if (error) throw error;
        return data?.[0] as RecordFile;
    } catch (error) {
        logError("createRecordApi", error);
        return null;
    }
};

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('land_records').update(payload).eq('id', record.id).select();
        if (error) throw error;
        return data?.[0] as RecordFile;
    } catch (error) {
        logError("updateRecordApi", error);
        return null;
    }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('land_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteRecordApi", error);
        return false;
    }
};

export const createRecordsBatchApi = async (records: RecordFile[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const payload = [];
        for (const r of records) {
            let finalCode = r.code;
            const isGeneratedFormat = finalCode && /^[A-ZĐ]{2,3}-\d{6}-\d{3,4}$/.test(finalCode);
            if (!finalCode || finalCode.includes('?') || isGeneratedFormat) {
                finalCode = await getNextGlobalRecordCode(r.ward || '', r.receivedDate || new Date().toISOString());
            }
            payload.push(sanitizeData({ ...r, code: finalCode }, RECORD_DB_COLUMNS));
        }
        const { error } = await supabase.from('land_records').insert(payload);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("createRecordsBatchApi", error);
        return false;
    }
};

export const forceUpdateRecordsBatchApi = async (records: RecordFile[]): Promise<{ success: boolean, count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    
    const isSupabase = API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        return { success: true, count: 0 };
    }

    try {
        const rawCodes = records.map(r => r.code).filter(c => c);
        if (rawCodes.length === 0) return { success: true, count: 0 };

        let allDbRecords: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('land_records')
                .select('*')
                .range(from, from + step - 1);
            
            if (error) throw error;

            if (data && data.length > 0) {
                allDbRecords = [...allDbRecords, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        const dbMap = new Map<string, any>();
        allDbRecords.forEach((r: any) => {
            if (r.code) {
                dbMap.set(normalizeCode(r.code), r);
            }
        });

        const updatesToPush: any[] = [];
        let updateCount = 0;

        records.forEach((excelRecord) => {
            const normCode = normalizeCode(excelRecord.code);
            const dbRecord = dbMap.get(normCode);
            
            if (dbRecord) {
                const merged = { ...dbRecord };
                let hasChange = false;

                Object.keys(excelRecord).forEach(key => {
                    const newVal = (excelRecord as any)[key];
                    const isValidValue = newVal !== null && newVal !== undefined && newVal !== '';
                    
                    if (isValidValue && key !== 'id') {
                        if (String(merged[key]) !== String(newVal)) {
                            merged[key] = newVal;
                            hasChange = true;
                        }
                    }
                });

                if (hasChange) {
                    updatesToPush.push(sanitizeData(merged, RECORD_DB_COLUMNS));
                    updateCount++;
                }
            }
        });

        if (updatesToPush.length > 0) {
            const { error: upsertError } = await supabase.from('land_records').upsert(updatesToPush);
            if (upsertError) throw upsertError;
        }

        return { success: true, count: updateCount };

    } catch (error) {
        logError("forceUpdateRecordsBatchApi", error);
        return { success: false, count: 0 };
    }
};

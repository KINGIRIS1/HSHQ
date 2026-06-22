
import { supabase, isConfigured } from './supabaseClient';
import { Holiday } from '../types';
import { logError, getFromCache, saveToCache, CACHE_KEYS } from './apiCore';

export const testDatabaseConnection = async (): Promise<{ status: string, message: string }> => {
    if (!isConfigured) {
        return { status: 'OFFLINE', message: 'Hệ thống chưa nhận diện được URL hoặc Key của Supabase.' };
    }
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1)
            .maybeSingle();

        if (error) {
            if (error.code === '42P01') return { status: 'ERROR', message: 'Lỗi 42P01: Bảng dữ liệu chưa tồn tại. Hãy chạy mã SQL trong nút "Xem mã SQL".' };
            if (error.message.includes('FetchError')) return { status: 'ERROR', message: 'Lỗi mạng: Không thể kết nối tới URL Supabase. Kiểm tra lại đường dẫn.' };
            if (error.code === 'PGRST301') return { status: 'ERROR', message: 'Lỗi quyền (JWT): Key không hợp lệ hoặc đã hết hạn.' };
            return { status: 'ERROR', message: `Lỗi Supabase: ${error.message} (Code: ${error.code})` };
        }
        
        return { status: 'SUCCESS', message: 'Kết nối thành công! Đã đọc được dữ liệu từ Supabase.' };

    } catch (e: any) {
        return { status: 'ERROR', message: `Lỗi ngoại lệ: ${e.message}` };
    }
};

export const fetchUpdateInfo = async (): Promise<{ version: string | null, url: string | null }> => {
    if (!isConfigured) return { version: null, url: null };
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('key, value')
            .in('key', ['app_version', 'app_update_url']);
            
        if (error) throw error;
        
        let version = null;
        let url = null;

        if (data) {
            data.forEach((item: any) => {
                if (item.key === 'app_version') version = item.value;
                if (item.key === 'app_update_url') url = item.value;
            });
        }
        return { version, url };
    } catch (e: any) {
        if (e?.code === '42P01') return { version: null, url: null };
        logError("fetchUpdateInfo", e);
        return { version: null, url: null };
    }
};

export const fetchLatestVersion = async (): Promise<string | null> => {
    const info = await fetchUpdateInfo();
    return info.version;
};

export const saveUpdateInfo = async (version: string, url: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const updates = [
            { key: 'app_version', value: version },
            { key: 'app_update_url', value: url }
        ];
        const { error } = await supabase.from('system_settings').upsert(updates);
        if (error) throw error;
        return true;
    } catch (e) {
        logError("saveUpdateInfo", e);
        return false;
    }
};

export const getSystemSetting = async (key: string): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error) throw error;
        return data?.value || null;
    } catch (error) {
        return null;
    }
};

export const saveSystemSetting = async (key: string, value: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase
            .from('system_settings')
            .upsert({ key, value });
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveSystemSetting", error);
        return false;
    }
};

export const updateLatestVersion = async (version: string): Promise<boolean> => {
    return saveUpdateInfo(version, ''); 
};

// --- HOLIDAYS ---
export const fetchHolidays = async (): Promise<Holiday[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    try {
        const { data, error } = await supabase.from('holidays').select('*');
        if (error) throw error;
        
        const mapped = data.map((h: any) => ({
            id: h.id,
            name: h.name,
            day: h.day,
            month: h.month,
            isLunar: h.is_lunar // Map từ snake_case (DB) sang camelCase (App)
        }));
        saveToCache(CACHE_KEYS.HOLIDAYS, mapped);
        return mapped;
    } catch (error) {
        logError("fetchHolidays", error);
        return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    }
};

export const saveHolidays = async (holidays: Holiday[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        // Xóa hết dữ liệu cũ trước khi insert mới
        // Lưu ý: Cần chắc chắn bảng holidays có ít nhất 1 dòng dummy với id='0' nếu dùng .neq('id', '0')
        // Hoặc xóa toàn bộ nếu không có dòng nào cần giữ. Ở đây ta xóa hết để sync chính xác.
        await supabase.from('holidays').delete().neq('id', 'dummy_id_prevent_error'); 
        
        const dbHolidays = holidays.map(h => ({
            id: h.id,
            name: h.name,
            day: h.day,
            month: h.month,
            is_lunar: h.isLunar // Map từ camelCase (App) sang snake_case (DB)
        }));
        
        const { error } = await supabase.from('holidays').insert(dbHolidays);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveHolidays", error);
        return false;
    }
};

export const deleteAllDataApi = async (): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        // Thực hiện xóa dữ liệu trên các bảng nghiệp vụ
        // Sử dụng neq('id', '0') để xóa tất cả các dòng
        
        const { error: err1 } = await supabase.from('land_records').delete().neq('id', '0'); 
        if (err1) throw err1;

        const { error: err2 } = await supabase.from('contracts').delete().neq('id', '0');
        if (err2) throw err2;

        const { error: err3 } = await supabase.from('excerpt_history').delete().neq('id', '0');
        if (err3) throw err3;

        const { error: err4 } = await supabase.from('messages').delete().neq('id', '0');
        if (err4) throw err4;

        // Xóa cả bộ đếm trích lục (nếu cần reset số thứ tự)
        const { error: err5 } = await supabase.from('excerpt_counters').delete().neq('ward', '0');
        if (err5) throw err5;

        // Lưu ý: Không xóa Users và Employees và SystemSettings để đảm bảo hệ thống vẫn đăng nhập được
        return true;
    } catch (error) {
        logError("deleteAllDataApi", error);
        return false;
    }
};

export const getPreviewContractCode = async (): Promise<string> => {
    if (!isConfigured) {
        const year = new Date().getFullYear();
        return `HĐ-${year}-0001`;
    }

    const year = new Date().getFullYear();
    let prefix = `HĐ-${year}-`;
    let nextSeq = 1;

    // 1. Lấy prefix
    try {
        const { data: prefixData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'contract_prefix')
            .single();

        if (prefixData && prefixData.value !== undefined && prefixData.value !== null) {
            prefix = prefixData.value.replace('{năm}', year.toString()).replace('{year}', year.toString());
        }
    } catch (e) {
        // Sử dụng giá trị mặc định nếu chưa cài đặt
    }

    // 2. Lấy số nhảy hiện tại (không tăng tịnh tiến trong DB)
    try {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'contract_next_seq')
            .single();

        if (data && data.value) {
            const currentVal = parseInt(data.value, 10);
            if (!isNaN(currentVal)) {
                nextSeq = currentVal;
            }
        }
    } catch (e) {
        // Sử dụng mặc định 1
    }

    const seqStr = nextSeq.toString().padStart(4, '0');
    return `${prefix}${seqStr}`;
};

export const consumeNextContractCode = async (): Promise<string> => {
    if (!isConfigured) {
        const year = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `HĐ-${year}-${randomNum}`;
    }

    const year = new Date().getFullYear();
    let success = false;
    let attempts = 0;
    let nextSeq = 1;
    let prefix = `HĐ-${year}-`;

    // 1. Lấy prefix
    try {
        const { data: prefixData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'contract_prefix')
            .single();

        if (prefixData && prefixData.value !== undefined && prefixData.value !== null) {
            prefix = prefixData.value.replace('{năm}', year.toString()).replace('{year}', year.toString());
        }
    } catch (e) {
        // Sử dụng giá trị mặc định nếu chưa cài đặt
    }

    // 2. Lấy số nhảy tiếp theo với logic retry để đảm bảo đồng bộ
    while (!success && attempts < 5) {
        attempts++;
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'contract_next_seq')
                .single();

            let currentVal = 1;
            if (data && data.value) {
                currentVal = parseInt(data.value, 10);
                if (isNaN(currentVal)) currentVal = 1;
            }

            nextSeq = currentVal;

            if (data) {
                const { data: updatedData, error } = await supabase
                    .from('system_settings')
                    .update({ value: (nextSeq + 1).toString() })
                    .eq('key', 'contract_next_seq')
                    .eq('value', data.value)
                    .select();

                if (!error && updatedData && updatedData.length > 0) {
                    success = true;
                }
            } else {
                const { data: insertedData, error } = await supabase
                    .from('system_settings')
                    .insert([{ key: 'contract_next_seq', value: (nextSeq + 1).toString() }])
                    .select();

                if (!error && insertedData && insertedData.length > 0) {
                    success = true;
                }
            }
        } catch (e) {
            // retry
        }

        if (!success) {
            await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 200));
        }
    }

    const seqStr = nextSeq.toString().padStart(4, '0');
    return `${prefix}${seqStr}`;
};

// Khai báo lại getNextContractCode để giữ độ tương thích nếu có import bên ngoài
export const getNextContractCode = consumeNextContractCode;


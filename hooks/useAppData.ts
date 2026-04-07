
import { useState, useEffect, useCallback } from 'react';
import { RecordFile, Employee, User, RecordStatus, Holiday, RolePermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { 
    fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi, getSystemSetting
} from '../services/api';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION } from '../constants';

export const useAppData = (currentUser: User | null) => {
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]); // State mới cho ngày nghỉ
    const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('connected');
    
    // Wards State
    const [wards, setWards] = useState<string[]>(() => {
        const saved = localStorage.getItem('wards_list');
        return saved ? JSON.parse(saved) : STATIC_WARDS;
    });

    // Update Info State
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState('');
    const [updateUrl, setUpdateUrl] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            // Tạo timeout promise để tránh việc fetch bị treo mãi mãi
            // Tăng timeout lên 30s để xử lý trường hợp mạng chậm hoặc DB bị sleep
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 30000)
            );

            const dataPromise = Promise.all([
                fetchRecords(),
                fetchEmployees(),
                fetchUsers(),
                fetchUpdateInfo(),
                fetchHolidays(), // Tải thêm danh sách ngày nghỉ
                getSystemSetting('role_permissions')
            ]);

            // Race giữa fetch data và timeout
            const [recData, empData, userData, updateInfo, holidayData, permsData] = await Promise.race([dataPromise, timeoutPromise]) as any;

            setRecords(recData);
            setEmployees(empData);
            setUsers(userData);
            setHolidays(holidayData); // Cập nhật state holidays
            if (permsData) {
                try {
                    setRolePermissions(JSON.parse(permsData));
                } catch (e) {
                    console.error("Failed to parse role_permissions", e);
                }
            }
            setConnectionStatus('connected');

            if (updateInfo && updateInfo.version && updateInfo.version !== APP_VERSION) {
                setIsUpdateAvailable(true);
                setLatestVersion(updateInfo.version);
                setUpdateUrl(updateInfo.url);
            }
        } catch (error) {
            console.error("Lỗi tải dữ liệu hoặc Timeout:", error);
            // Quan trọng: Khi lỗi, chuyển sang OFFLINE nhưng vẫn cho phép App hoạt động
            // Dữ liệu sẽ được lấy từ Cache (đã xử lý trong apiCore)
            setConnectionStatus('offline');
            
            // Nếu cache cũng rỗng (lần đầu chạy), khởi tạo mảng rỗng để không crash UI
            setRecords((prev) => prev.length > 0 ? prev : []);
            setEmployees((prev) => prev.length > 0 ? prev : []);
            setUsers((prev) => prev.length > 0 ? prev : []);
            // Holidays sẽ tự lấy từ cache trong apiSystem nếu lỗi
        }
    }, []);

    // Initial Load & Polling
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // 30s refresh
        return () => clearInterval(interval);
    }, [loadData]);

    // --- Record Handlers ---
    const handleAddOrUpdateRecord = async (recordData: any): Promise<RecordFile | null> => {
        if (recordData.recordType === 'Cung cấp tài liệu đất đai') {
            const { saveArchiveRecord } = await import('../services/apiArchive');
            const archiveData = {
                type: 'saoluc' as const,
                so_hieu: recordData.code || '',
                trich_yeu: recordData.content || recordData.recordType || '',
                ngay_thang: recordData.receivedDate || '',
                noi_nhan_gui: recordData.customerName || '',
                status: 'draft' as const,
                data: {
                    ...recordData,
                    xa_phuong: recordData.ward || '',
                    to_ban_do: recordData.mapSheet || '',
                    thua_dat: recordData.landPlot || '',
                    hen_tra: recordData.deadline || ''
                }
            };
            const savedArchive = await saveArchiveRecord(archiveData);
            if (savedArchive) {
                // Return a fake RecordFile so the UI can print it, but don't add to land_records state
                return { ...recordData, id: savedArchive.id } as RecordFile;
            }
            return null;
        }

        const isEdit = recordData.id && records.find(r => r.id === recordData.id);
        if (isEdit) {
            const updated = await updateRecordApi(recordData);
            if (updated) {
                setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                return updated;
            }
        } else {
            const newRecord = await createRecordApi({ ...recordData, id: Math.random().toString(36).substr(2, 9) });
            if (newRecord) {
                setRecords(prev => [newRecord, ...prev]);
                return newRecord;
            }
        }
        return null;
    };

    const handleDeleteRecord = async (id: string) => {
        const success = await deleteRecordApi(id);
        if (success) {
            setRecords(prev => prev.filter(r => r.id !== id));
        }
        return success;
    };

    const handleImportRecords = async (newRecords: RecordFile[]) => {
        const landRecordsToImport = newRecords.filter(r => r.recordType !== 'Cung cấp tài liệu đất đai');
        const archiveRecordsToImport = newRecords.filter(r => r.recordType === 'Cung cấp tài liệu đất đai');

        let success = true;

        if (landRecordsToImport.length > 0) {
            const landSuccess = await createRecordsBatchApi(landRecordsToImport);
            if (!landSuccess) success = false;
        }

        if (archiveRecordsToImport.length > 0) {
            const { importArchiveRecords } = await import('../services/apiArchive');
            const archiveData = archiveRecordsToImport.map(r => ({
                type: 'saoluc' as const,
                so_hieu: r.code || '',
                trich_yeu: r.content || r.recordType || '',
                ngay_thang: r.receivedDate || '',
                noi_nhan_gui: r.customerName || '',
                status: 'draft' as const,
                data: {
                    ...r,
                    xa_phuong: r.ward || '',
                    to_ban_do: r.mapSheet || '',
                    thua_dat: r.landPlot || '',
                    hen_tra: r.deadline || ''
                }
            }));
            const archiveSuccess = await importArchiveRecords(archiveData);
            if (!archiveSuccess) success = false;
        }

        if (success) {
            await loadData();
            return true;
        }
        return false;
    };

    const handleBatchUpdate = async (updatedRecords: RecordFile[]) => {
        // Optimistic update
        const updatedIds = updatedRecords.map(r => r.id);
        setRecords(prev => prev.map(r => {
            const found = updatedRecords.find(u => u.id === r.id);
            return found ? found : r;
        }));
    };

    // --- Employee Handlers ---
    const handleSaveEmployee = async (emp: Employee) => {
        const exists = employees.find(e => e.id === emp.id);
        const savedEmp = await saveEmployeeApi(emp, !!exists);
        if (savedEmp) {
            if (exists) setEmployees(prev => prev.map(e => e.id === savedEmp.id ? savedEmp : e));
            else setEmployees(prev => [...prev, savedEmp]);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        const success = await deleteEmployeeApi(id);
        if (success) setEmployees(prev => prev.filter(e => e.id !== id));
    };

    // --- User Handlers ---
    const handleUpdateUser = async (u: User, isUpdate: boolean) => {
        const res = await saveUserApi(u, isUpdate);
        if (res) {
            if (isUpdate) setUsers(prev => prev.map(x => x.username === u.username ? res : x));
            else setUsers(prev => [...prev, res]);
        }
        return res;
    };

    const handleDeleteUser = async (username: string) => {
        const success = await deleteUserApi(username);
        if (success) setUsers(prev => prev.filter(u => u.username !== username));
    };

    // --- System Handlers ---
    const handleDeleteAllData = async () => {
        const success = await deleteAllDataApi();
        if (success) {
            setRecords([]);
            return true;
        }
        return false;
    };

    return {
        records, employees, users, wards, holidays, rolePermissions, connectionStatus,
        isUpdateAvailable, latestVersion, updateUrl,
        setWards, setEmployees, setUsers, setRecords,
        loadData,
        handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords, handleBatchUpdate,
        handleSaveEmployee, handleDeleteEmployee,
        handleUpdateUser, handleDeleteUser,
        handleDeleteAllData
    };
};

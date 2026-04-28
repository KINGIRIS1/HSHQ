import React, { useMemo, useState } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import { isRecordOverdue } from '../../utils/appHelpers';
import { exportOverdueStatsToExcel } from '../../utils/excelExport';
import { AlertTriangle, CheckCircle2, Clock, MapPin, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface OverdueStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
}

const OverdueStatsView: React.FC<OverdueStatsViewProps> = ({ records, employees }) => {
    const [filterType, setFilterType] = useState<'all' | 'completed' | 'pending'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const overdueData = useMemo(() => {
        const completed: RecordFile[] = [];
        const pending: RecordFile[] = [];

        records.forEach(r => {
            // Check pending overdue
            const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
            const isWithdrawnOrRejected = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
            
            if (!isDone && !isWithdrawnOrRejected) {
                if (isRecordOverdue(r)) {
                    pending.push(r);
                }
            } else if (isDone) {
                if (r.deadline && r.completedDate) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                    if (c > d) {
                        completed.push(r);
                    }
                }
            }
        });

        // Add an extra property to indicate type of overdue
        const completedWithType = completed.map(r => ({ ...r, _overdueType: 'completed' }));
        const pendingWithType = pending.map(r => ({ ...r, _overdueType: 'pending' }));

        let combined = [...completedWithType, ...pendingWithType];
        
        if (filterType === 'completed') {
            combined = completedWithType;
        } else if (filterType === 'pending') {
            combined = pendingWithType;
        }

        // Sort by deadline ascending (most overdue first)
        combined.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });

        return {
            totalCompleted: completed.length,
            totalPending: pending.length,
            filteredRecords: combined
        };
    }, [records, filterType]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return overdueData.filteredRecords.slice(start, start + itemsPerPage);
    }, [overdueData.filteredRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(overdueData.filteredRecords.length / itemsPerPage);

    // Reset page when filter changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filterType, records]);

    const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-y-hidden">
            {/* Tóm tắt */}
            <div className="flex gap-4 shrink-0">
                <div 
                    onClick={() => setFilterType('all')}
                    className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${filterType === 'all' ? 'bg-red-50 border-red-200 shadow-sm ring-1 ring-red-400' : 'bg-white border-gray-200 hover:border-red-300'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-lg text-red-600"><AlertTriangle size={24}/></div>
                        <div>
                            <div className="text-2xl font-bold text-red-800">{overdueData.totalCompleted + overdueData.totalPending}</div>
                            <div className="text-sm text-red-600 font-medium">Tổng hồ sơ trễ hạn</div>
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => setFilterType('pending')}
                    className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${filterType === 'pending' ? 'bg-orange-50 border-orange-200 shadow-sm ring-1 ring-orange-400' : 'bg-white border-gray-200 hover:border-orange-300'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Clock size={24}/></div>
                        <div>
                            <div className="text-2xl font-bold text-orange-800">{overdueData.totalPending}</div>
                            <div className="text-sm text-orange-600 font-medium">Trễ - Chưa có kết quả</div>
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => setFilterType('completed')}
                    className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${filterType === 'completed' ? 'bg-yellow-50 border-yellow-200 shadow-sm ring-1 ring-yellow-400' : 'bg-white border-gray-200 hover:border-yellow-300'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600"><CheckCircle2 size={24}/></div>
                        <div>
                            <div className="text-2xl font-bold text-yellow-800">{overdueData.totalCompleted}</div>
                            <div className="text-sm text-yellow-600 font-medium">Trễ - Đã có kết quả</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bảng dữ liệu */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-700">
                        {filterType === 'all' ? 'Tất cả hồ sơ trễ hạn' : filterType === 'pending' ? 'Hồ sơ trễ - Chưa có kết quả' : 'Hồ sơ trễ - Đã có kết quả'}
                    </h3>
                    <button 
                        onClick={() => exportOverdueStatsToExcel(overdueData.filteredRecords, employees, filterType)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium text-sm shadow-sm"
                    >
                        <Download size={16} /> Xuất Excel
                    </button>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3">Mã HS</th>
                                <th className="p-3">Chủ sử dụng</th>
                                <th className="p-3">Xã/Phường</th>
                                <th className="p-3">Loại trễ</th>
                                <th className="p-3">Ngày nhận</th>
                                <th className="p-3">Hẹn trả</th>
                                <th className="p-3">Hoàn thành</th>
                                <th className="p-3">NV Xử lý</th>
                                <th className="p-3 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedData.length > 0 ? paginatedData.map((r: any, i) => {
                                const emp = employees.find(e => e.id === r.assignedTo);
                                const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                const isPendingOverdue = r._overdueType === 'pending';
                                
                                return (
                                <tr key={r.id} className="hover:bg-red-50/30 transition-colors">
                                    <td className="p-3 text-center text-gray-400">{rowIndex}</td>
                                    <td className="p-3 font-medium text-red-600">{r.code}</td>
                                    <td className="p-3 font-medium">{r.customerName}</td>
                                    <td className="p-3 text-gray-600 flex items-center gap-1"><MapPin size={12}/>{getNormalizedWard(r.ward)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 flex w-fit items-center gap-1 rounded text-xs font-bold ${isPendingOverdue ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {isPendingOverdue ? <Clock size={12}/> : <CheckCircle2 size={12}/>}
                                            {isPendingOverdue ? 'Chưa có kết quả' : 'Đã có kết quả'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
                                    <td className="p-3 font-bold text-red-600">{formatDate(r.deadline)}</td>
                                    <td className="p-3 text-gray-600">{formatDate(r.completedDate)}</td>
                                    <td className="p-3 text-gray-600 truncate max-w-[150px]" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                    <td className="p-3 text-center">
                                        <span className="px-2 py-1 rounded text-xs border bg-gray-50 text-gray-600 border-gray-200">
                                            {STATUS_LABELS[r.status as RecordStatus]}
                                        </span>
                                    </td>
                                </tr>
                            )}) : (
                                <tr><td colSpan={10} className="p-8 text-center text-gray-400">Không có dữ liệu trễ hạn trong khoảng thời gian này.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {overdueData.filteredRecords.length > 0 && (
                    <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center shrink-0">
                        <span className="text-xs text-gray-500">
                            Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, overdueData.filteredRecords.length)}</strong> trên tổng <strong>{overdueData.filteredRecords.length}</strong>
                        </span>
                        <div className="flex items-center gap-1">
                            <div className="flex items-center mr-4 gap-2">
                                <span className="text-xs text-gray-500">Số lượng:</span>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))} 
                                    className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-red-400"
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                            <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OverdueStatsView;

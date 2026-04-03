import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, FileSignature } from 'lucide-react';
import { RecordFile, UserRole, User } from '../../types';

interface SubmitModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: RecordFile[];
    onConfirm: (directorId: string) => void;
    users: User[];
}

const SubmitModal: React.FC<SubmitModalProps> = ({ isOpen, onClose, records, onConfirm, users }) => {
    const [selectedDirector, setSelectedDirector] = useState<string>('');

    // Lọc ra các user thuộc Ban giám đốc (role ADMIN hoặc SUBADMIN)
    const directors = users.filter((u: User) => (u.role === UserRole.ADMIN || u.role === UserRole.SUBADMIN) && u.employeeId);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!selectedDirector) {
            alert('Vui lòng chọn người được trình ký.');
            return;
        }
        onConfirm(selectedDirector);
        setSelectedDirector('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in-up">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <FileSignature size={20} />
                        Trình Ký Duyệt
                    </h2>
                    <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <p className="text-gray-700 mb-2 font-medium">
                            Bạn đang trình ký <span className="font-bold text-indigo-600">{records.length}</span> hồ sơ.
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                            Vui lòng chọn Giám đốc/Phó giám đốc để trình ký:
                        </p>
                        
                        <div className="space-y-2">
                            {directors.map((director: User) => (
                                <label 
                                    key={director.employeeId} 
                                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${selectedDirector === director.employeeId ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="director" 
                                        value={director.employeeId} 
                                        checked={selectedDirector === director.employeeId}
                                        onChange={(e) => setSelectedDirector(e.target.value)}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                    />
                                    <div className="ml-3">
                                        <span className="block text-sm font-medium text-gray-900">{director.name}</span>
                                        <span className="block text-xs text-gray-500">{director.role === UserRole.ADMIN ? 'Giám đốc' : 'Phó giám đốc'}</span>
                                    </div>
                                </label>
                            ))}
                            {directors.length === 0 && (
                                <div className="text-sm text-red-500 flex items-center gap-1 p-2 bg-red-50 rounded-lg">
                                    <AlertCircle size={14} /> Không tìm thấy user Ban giám đốc nào.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button 
                            onClick={onClose} 
                            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={!selectedDirector}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-white transition-all shadow-md ${selectedDirector ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-300 cursor-not-allowed'}`}
                        >
                            <CheckCircle size={18} />
                            Xác nhận trình ký
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubmitModal;
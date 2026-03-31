import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { RecordFile } from '../../types';
import { getNormalizedWard } from '../../constants';
import { Printer } from 'lucide-react';

interface SystemReceiptTemplateProps {
    data: Partial<RecordFile>;
    onClose: () => void;
}

const SystemReceiptTemplate: React.FC<SystemReceiptTemplateProps> = ({ data, onClose }) => {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        if (!printRef.current) return;
        const printContent = printRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>In Biên Nhận</title>
                    <style>
                        body { font-family: 'Times New Roman', Times, serif; padding: 20px; line-height: 1.5; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                        .barcode-container { display: flex; justify-content: center; margin-bottom: 20px; }
                        .info-row { display: flex; margin-bottom: 8px; }
                        .info-label { font-weight: bold; width: 150px; }
                        .info-value { flex: 1; }
                        .signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
                        .signature-box { width: 45%; }
                        @media print {
                            @page { margin: 2cm; }
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const rDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    const dDate = data.deadline ? new Date(data.deadline) : new Date();

    const formatDate = (d: Date) => {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">In Biên Nhận (Mẫu Hệ Thống)</h2>
                    <div className="flex space-x-2">
                        <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <Printer className="w-4 h-4 mr-2" /> In Biên Nhận
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                            Đóng
                        </button>
                    </div>
                </div>
                
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
                    <div className="bg-white p-10 shadow-sm border border-gray-200 mx-auto" style={{ maxWidth: '210mm', minHeight: '297mm' }} ref={printRef}>
                        <div className="header">
                            <div className="text-lg font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                            <div className="text-md font-semibold underline mb-6">Độc lập - Tự do - Hạnh phúc</div>
                            
                            <div className="title">BIÊN NHẬN HỒ SƠ</div>
                            <div className="text-sm italic mb-2">Mã hồ sơ: {data.code}</div>
                            
                            {data.code && (
                                <div className="barcode-container">
                                    <Barcode value={data.code} height={40} displayValue={false} margin={0} />
                                </div>
                            )}
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="info-row">
                                <div className="info-label">Tên khách hàng:</div>
                                <div className="info-value uppercase font-bold">{data.customerName}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Số điện thoại:</div>
                                <div className="info-value">{data.phoneNumber}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Địa chỉ:</div>
                                <div className="info-value">{data.address}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Loại hồ sơ:</div>
                                <div className="info-value font-semibold">{data.recordType}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Xã/Phường:</div>
                                <div className="info-value">{getNormalizedWard(data.ward || '')}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Số tờ bản đồ:</div>
                                <div className="info-value">{data.mapSheet}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Số thửa đất:</div>
                                <div className="info-value">{data.landPlot}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Diện tích:</div>
                                <div className="info-value">{data.area ? `${data.area} m²` : ''}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Ngày nhận:</div>
                                <div className="info-value">{formatDate(rDate)}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Ngày hẹn trả:</div>
                                <div className="info-value font-bold">{formatDate(dDate)}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Ghi chú:</div>
                                <div className="info-value">{data.notes}</div>
                            </div>
                        </div>

                        <div className="signatures">
                            <div className="signature-box">
                                <div className="font-bold mb-16">Người nộp hồ sơ</div>
                                <div>(Ký, ghi rõ họ tên)</div>
                            </div>
                            <div className="signature-box">
                                <div className="font-bold mb-16">Người nhận hồ sơ</div>
                                <div>(Ký, ghi rõ họ tên)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemReceiptTemplate;

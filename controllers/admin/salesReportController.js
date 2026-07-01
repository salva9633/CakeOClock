import Order from "../../models/orderModel.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import moment from "moment";
 
// ===============================
// SHARED DATE FILTER HELPER
// ===============================
 
function getDateRange(filter, queryStart, queryEnd) {
  let startDate;
  let endDate = new Date();
 
  switch (filter) {
    case "daily":
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      break;
 
    case "weekly": {
      startDate = new Date();
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
 
    case "yearly":
      startDate = new Date(new Date().getFullYear(), 0, 1);
      break;
 
    case "custom":
      startDate = queryStart ? new Date(queryStart) : new Date();
      endDate   = queryEnd   ? new Date(queryEnd)   : new Date();
      endDate.setHours(23, 59, 59, 999);
      break;
 
  default: // monthly
      startDate = new Date(
        new Date().getFullYear(),
        0,
        1
      );
  }
 
  return { startDate, endDate };
}
 
// ===============================
// SALES REPORT PAGE
// ===============================
 
export const loadSalesReport = async (req, res) => {
  try {
    const filter = req.query.filter || "monthly";
 
    const { startDate, endDate } = getDateRange(
      filter,
      req.query.startDate,
      req.query.endDate
    );
 
const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: "Delivered"
    };
 
    // ── Pagination ──
    const page  = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip  = (page - 1) * limit;
 
    const totalOrders = await Order.countDocuments(query);
    const totalPages  = Math.ceil(totalOrders / limit);
 
    // ── All orders (for metrics + charts) ──
    const allOrders = await Order.find(query).sort({ createdAt: -1 });
 
    // ── Paginated orders (for table) ──
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
 
    // ── Calculations ──
    const overallSalesCount  = allOrders.length;
    const overallOrderAmount = allOrders.reduce((sum, o) => sum + o.finalTotal, 0);
    const overallDiscount    = allOrders.reduce((sum, o) => sum + (o.offerDiscount || 0), 0);
    const couponDeduction    = allOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
 
   // ── Chart data (grouped by period) ──
// ── Chart data (grouped by period) ──
let chartLabels = [];
let chartData = [];

if (filter === "daily") {

  const hourMap = {};

  for (let h = 0; h < 24; h++) {
    hourMap[`${String(h).padStart(2, "0")}:00`] = 0;
  }

  allOrders.forEach(order => {
    const hour = `${String(
      new Date(order.createdAt).getHours()
    ).padStart(2, "0")}:00`;

    hourMap[hour] += order.finalTotal;
  });

  chartLabels = Object.keys(hourMap);
  chartData = Object.values(hourMap);

} else if (filter === "weekly") {

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayMap = {};

  days.forEach(day => {
    dayMap[day] = 0;
  });

  allOrders.forEach(order => {
    const jsDay = new Date(order.createdAt).getDay();
    const dayName = days[jsDay === 0 ? 6 : jsDay - 1];

    dayMap[dayName] += order.finalTotal;
  });

  chartLabels = Object.keys(dayMap);
  chartData = Object.values(dayMap);

} else if (filter === "yearly") {

  const currentYear = new Date().getFullYear();
  const yearMap = {};

  for (let year = currentYear - 4; year <= currentYear; year++) {
    yearMap[String(year)] = 0;
  }

  allOrders.forEach(order => {
    const year = String(
      new Date(order.createdAt).getFullYear()
    );

    if (yearMap[year] !== undefined) {
      yearMap[year] += order.finalTotal;
    }
  });

  chartLabels = Object.keys(yearMap);
  chartData = Object.values(yearMap);

} else if (filter === "custom") {

  const dateMap = {};

  allOrders.forEach(order => {
    const date = moment(order.createdAt).format("DD MMM");

    dateMap[date] = (dateMap[date] || 0) + order.finalTotal;
  });

  chartLabels = Object.keys(dateMap);
  chartData = Object.values(dateMap);

} else {

  // Monthly (Jan-Dec)

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const monthMap = {};

  months.forEach(month => {
    monthMap[month] = 0;
  });

  allOrders.forEach(order => {
    const month = months[
      new Date(order.createdAt).getMonth()
    ];

    monthMap[month] += order.finalTotal;
  });

  chartLabels = Object.keys(monthMap);
  chartData = Object.values(monthMap);
}
// ── Status counts ──

// ── Status counts ──
 
    // ── Status counts ──
    const statusCounts = {};
    allOrders.forEach(o => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
 
    return res.render("sales-report", {
      orders,
      overallSalesCount,
      overallOrderAmount,
      overallDiscount,
      couponDeduction,
      chartLabels,
      chartData,
      statusCounts,
      filter,
      page,
      totalPages,
      startDate: req.query.startDate || "",
      endDate:   req.query.endDate   || ""
    });
 
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageerror");
  }
};
 
// ===============================
// PDF EXPORT
// ===============================
 
 
export const exportSalesPdf = async (req, res) => {
  try {
    const filter = req.query.filter || "monthly";
    const { startDate, endDate } = getDateRange(filter, req.query.startDate, req.query.endDate);
 
   const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: "Delivered"
    }).sort({ createdAt: -1 });
 
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
    doc.pipe(res);
 
    const PW  = doc.page.width;   // 595
    const PAD = 40;
    const CW  = PW - PAD * 2;     // 515
 
    // ── HEADER BAND ──
    doc.rect(0, 0, PW, 80).fill('#C97B8A');
 
    // subtle accent underline beneath the header band
    doc.rect(0, 80, PW, 3).fill('#A85F6E');
 
    doc.fontSize(20).fillColor('#fff').font('Helvetica-Bold')
       .text("Cake O'Clock", PAD, 18);
    doc.fontSize(9).fillColor('#FCE7EC').font('Helvetica')
       .text('Sales Report', PAD, 44);
 
    // period badge (top right)
    doc.fontSize(8).fillColor('#fff')
       .text(
         `${moment(startDate).format('DD MMM YYYY')} – ${moment(endDate).format('DD MMM YYYY')}`,
         0, 30, { align: 'right', width: PW - PAD }
       );
 
    let y = 100;
 
    // ── SUMMARY BOXES ──
    // (Discounts card removed — now 3 boxes: Orders, Revenue, Coupon Savings)
    const totalRevenue = orders.reduce((s, o) => s + o.finalTotal, 0);
    const totalCoupon  = orders.reduce((s, o) => s + (o.discount || 0), 0);
 
    const summaries = [
      { label: 'Total Orders',   value: String(orders.length) },
      { label: 'Total Revenue',  value: `Rs.${totalRevenue.toLocaleString('en-IN')}` },
      { label: 'Coupon Savings', value: `Rs.${totalCoupon.toFixed(2)}` },
    ];
 
    const boxGap = 10;
    const boxW = (CW - boxGap * (summaries.length - 1)) / summaries.length;
    const boxH = 56;
 
    summaries.forEach((s, i) => {
      const bx = PAD + i * (boxW + boxGap);
      doc.roundedRect(bx, y, boxW, boxH, 8).fill('#FDF0F3');
      doc.roundedRect(bx, y, 4, boxH, 2).fill('#C97B8A');
      doc.fontSize(8.5).fillColor('#B08A8A').font('Helvetica')
         .text(s.label.toUpperCase(), bx + 14, y + 12, { width: boxW - 24 });
      doc.fontSize(16).fillColor('#5C3A3A').font('Helvetica-Bold')
         .text(s.value, bx + 14, y + 28, { width: boxW - 24 });
    });
 
    y += boxH + 24;
 
    // ── TABLE ──
    const cols = [
      { label: 'Order ID',   x: PAD,       w: 150, align: 'left'  },
      { label: 'Date',       x: PAD + 153, w: 80,  align: 'left'  },
      { label: 'Payment',    x: PAD + 236, w: 80,  align: 'left'  },
      { label: 'Amount',     x: PAD + 319, w: 100, align: 'right' },
      { label: 'Status',     x: PAD + 422, w: 93,  align: 'left'  },
    ];
 
    const ROW_H  = 22;
    const HEAD_H = 26;
 
    const drawTableHeader = () => {
      doc.roundedRect(PAD, y, CW, HEAD_H, 4).fill('#C97B8A');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#fff');
      cols.forEach(c => {
        doc.text(c.label, c.x + 4, y + 9, { width: c.w - 8, align: c.align });
      });
      y += HEAD_H;
    };
 
    drawTableHeader();
 
    orders.forEach((order, idx) => {
      // Page break check
      if (y + ROW_H > doc.page.height - 60) {
        doc.addPage();
        y = 24;
        drawTableHeader();
      }
 
      // Alternating row background
      doc.rect(PAD, y, CW, ROW_H).fill(idx % 2 === 0 ? '#fff' : '#FDF0F3');
 
      // Row border
      doc.moveTo(PAD, y + ROW_H).lineTo(PAD + CW, y + ROW_H)
         .lineWidth(0.3).stroke('#F5D8E0');
 
      doc.font('Helvetica').fontSize(8).fillColor('#5C3A3A');
 
      const row = [
        String(order.orderId || '').substring(0, 22),
        moment(order.createdAt).format('DD-MM-YYYY'),
        String(order.paymentMethod || ''),
        `Rs.${order.finalTotal.toFixed(2)}`,
        order.status,
      ];
 
      cols.forEach((c, ci) => {
        doc.text(row[ci], c.x + 4, y + 7, { width: c.w - 8, align: c.align, ellipsis: true });
      });
 
      y += ROW_H;
    });
 
    // ── TOTALS ROW ──
    if (y + ROW_H + 2 > doc.page.height - 60) {
      doc.addPage();
      y = 24;
    }
 
    doc.roundedRect(PAD, y, CW, ROW_H + 4, 4).fill('#FAE8ED');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#A85F6E');
    doc.text('TOTALS', cols[0].x + 4, y + 9, { width: cols[0].w - 8 });
 
    doc.text(
      `Rs.${totalRevenue.toFixed(2)}`,
      cols[3].x + 4, y + 9, { width: cols[3].w - 8, align: 'right' }
    );
 
    y += ROW_H + 20;
 
    // ── FOOTER ──
    doc.fontSize(8).fillColor('#B08A8A').font('Helvetica')
       .text(
         `Generated on ${moment().format('DD MMM YYYY, hh:mm A')}   ·   Cake O'Clock`,
         PAD, y, { align: 'center', width: CW }
       );
 
    doc.end();
 
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageerror");
  }
};
// ===============================
// EXCEL EXPORT
// ===============================
 
export const exportSalesExcel = async (req, res) => {
  try {
    const filter = req.query.filter || "monthly";
 
    const { startDate, endDate } = getDateRange(
      filter,
      req.query.startDate,
      req.query.endDate
    );
 
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: "Delivered"
    }).sort({ createdAt: -1 });
 
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");
 
    // ── Columns ──
    worksheet.columns = [
      { header: "Order ID",            key: "orderId",       width: 28 },
      { header: "Date",                key: "date",          width: 15 },
      { header: "Payment Method",      key: "paymentMethod", width: 18 },
      { header: "Coupon Code",         key: "couponCode",    width: 16 },
      { header: "Discount (Rs.)",      key: "discount",      width: 16 },
      { header: "Coupon Saving (Rs.)", key: "couponSaving",  width: 18 },
      { header: "Final Amount (Rs.)",  key: "amount",        width: 18 },
      { header: "Status",              key: "status",        width: 14 },
    ];
 
    // ── Style header row ──
    worksheet.getRow(1).eachCell(cell => {
      cell.font      = { bold: true, color: { argb: "FF5C3A3A" } };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAE8ED" } };
      cell.alignment = { horizontal: "center" };
    });
 
    // ── Data rows ──
    orders.forEach(order => {
      worksheet.addRow({
        orderId:       order.orderId,
        date:          moment(order.createdAt).format("DD-MM-YYYY"),
        paymentMethod: order.paymentMethod || "",
        couponCode:    order.couponCode    || "—",
        discount:      +(order.offerDiscount || 0).toFixed(2),
        couponSaving:  +(order.discount      || 0).toFixed(2),
        amount:        +order.finalTotal.toFixed(2),
        status:        order.status,
      });
    });
 
    // ── Totals row ──
    const totalsRow = worksheet.addRow({
      orderId:      "TOTALS",
      discount:     +orders.reduce((s, o) => s + (o.offerDiscount || 0), 0).toFixed(2),
      couponSaving: +orders.reduce((s, o) => s + (o.discount      || 0), 0).toFixed(2),
      amount:       +orders.reduce((s, o) => s + o.finalTotal,            0).toFixed(2),
    });
    totalsRow.font = { bold: true };
 
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.xlsx"
    );
 
    await workbook.xlsx.write(res);
    res.end();
 
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageerror");
  }
};
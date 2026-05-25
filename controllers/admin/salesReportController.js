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
        new Date().getMonth(),
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
 
    // ── Query ──
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status:    { $nin: ["Cancelled"] }
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
 
    // ── Chart data ──
    const chartLabels = allOrders.map(o => moment(o.createdAt).format("DD MMM"));
    const chartData   = allOrders.map(o => o.finalTotal);
 
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
 
    const { startDate, endDate } = getDateRange(
      filter,
      req.query.startDate,
      req.query.endDate
    );
 
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status:    { $nin: ["Cancelled"] }
    }).sort({ createdAt: -1 });
 
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
    doc.pipe(res);
 
    // ── Title ──
    doc.fontSize(20).fillColor("#5C3A3A")
       .text("Sales Report", { align: "center" });
    doc.fontSize(11).fillColor("#B08A8A")
       .text(
         `Period: ${moment(startDate).format("DD MMM YYYY")} – ${moment(endDate).format("DD MMM YYYY")}`,
         { align: "center" }
       );
    doc.moveDown();
 
    // ── Summary ──
    const totalRevenue  = orders.reduce((s, o) => s + o.finalTotal, 0);
    const totalDiscount = orders.reduce((s, o) => s + (o.offerDiscount || 0), 0);
    const totalCoupon   = orders.reduce((s, o) => s + (o.discount || 0), 0);
 
    doc.fontSize(12).fillColor("#5C3A3A");
    doc.text(`Total Orders:    ${orders.length}`);
    doc.text(`Total Revenue:   Rs.${totalRevenue.toFixed(2)}`);
    doc.text(`Discounts:       Rs.${totalDiscount.toFixed(2)}`);
    doc.text(`Coupon Savings:  Rs.${totalCoupon.toFixed(2)}`);
    doc.moveDown();
 
    // ── Table header ──
    doc.fontSize(10).fillColor("#B08A8A")
       .text(
         "ORDER ID              DATE         PAYMENT       DISCOUNT      AMOUNT        STATUS",
         { underline: true }
       );
    doc.moveDown(0.3);
 
    // ── Rows ──
    doc.fontSize(9).fillColor("#5C3A3A");
    orders.forEach(order => {
      const line = [
        String(order.orderId || "").substring(0, 20).padEnd(22),
        moment(order.createdAt).format("DD-MM-YYYY").padEnd(13),
        String(order.paymentMethod || "").padEnd(14),
        `Rs.${(order.offerDiscount || 0).toFixed(2)}`.padEnd(14),
        `Rs.${order.finalTotal.toFixed(2)}`.padEnd(14),
        order.status
      ].join("");
 
      doc.text(line);
      if (doc.y > 700) doc.addPage();
    });
 
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
      status:    { $nin: ["Cancelled"] }
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
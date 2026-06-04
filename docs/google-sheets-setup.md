# Guía de Configuración: Integración con Google Sheets

Esta guía te indica cómo configurar el Webhook de Google Apps Script para recibir los cierres diarios de mesas y exportaciones de torneos, escribiéndolos directamente en archivos de Google Sheets en tu Google Drive.

- **Cierres de mesas**: Se crea un documento mensual (`Cierres - Mes Año`) con pestañas por día operativo.
- **Torneos**: Se crea un documento `Torneos - Experience Poker Room` con una pestaña por torneo más una pestaña de resumen mensual.

## Paso 1: Crear el script en Google Drive

1. Ve a [Google Drive](https://drive.google.com/) con tu cuenta de Google.
2. Haz clic en **Nuevo** > **Más** > **Google Apps Script** (si no te aparece, puedes ir a [script.google.com](https://script.google.com/) y crear un **Nuevo proyecto**).
3. Cambia el nombre del proyecto en la parte superior izquierda a `Poker Room Cierres Webhook`.
4. Borra el código por defecto en el archivo `Código.gs` y pega el código base que se proporciona a continuación.

## Código Base para Google Apps Script

```javascript
/**
 * Poker Room Sheets Webhook
 * Permite recibir cierres de mesa e insertarlos en un Spreadsheet mensual
 * con pestañas individuales por día operativo.
 */

function doPost(e) {
  try {
    // Verificar que el payload no esté vacío
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ ok: false, error: "No post data received" });
    }
    
    // Parsear payload
    var payload = JSON.parse(e.postData.contents);
    var type = payload.type || "daily_closure";
    var dateStr = payload.date; // YYYY-MM-DD
    
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return responseJSON({ ok: false, error: "Fecha inválida. Debe ser YYYY-MM-DD" });
    }
    
    // Extraer año, mes y día de la fecha operativa
    var parts = dateStr.split('-');
    var year = parts[0];
    var monthNum = parts[1];
    var dayNum = parts[2];
    
    // Nombres de los meses en español
    var months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    var monthName = months[parseInt(monthNum, 10) - 1];
    
    // Nombre del documento mensual
    var spreadsheetName = "Cierres - " + monthName + " " + year;
    var tabName = "Día " + parseInt(dayNum, 10); // ej. "Día 20"
    
    // Buscar o crear Spreadsheet mensual
    var spreadsheet = getOrCreateSpreadsheet(spreadsheetName);
    
    // Buscar o crear pestaña del día
    var sheet = spreadsheet.getSheetByName(tabName);
    if (sheet) {
      sheet.clear(); // Limpiar contenido previo para sobreescribir
    } else {
      sheet = spreadsheet.insertSheet(tabName);
    }
    
    // Activar la hoja
    spreadsheet.setActiveSheet(sheet);
    
    // Ocultar la hoja default si es necesario
    var defaultSheet = spreadsheet.getSheetByName("Hoja 1") || spreadsheet.getSheetByName("Sheet1");
    if (defaultSheet && spreadsheet.getSheets().length > 1) {
      try {
        spreadsheet.deleteSheet(defaultSheet);
      } catch(e) {}
    }

    if (type === "daily_closure") {
      writeDailyClosure(sheet, dateStr, payload.dailyClosure, payload.tableClosures || []);
    } else if (type === "table_closure") {
      writeSingleTableClosure(sheet, dateStr, payload.tableClosure);
    } else if (type === "tournament_export") {
      return writeTournamentExport(payload);
    } else {
      return responseJSON({ ok: false, error: "Tipo de exportación desconocido: " + type });
    }
    
    return responseJSON({
      ok: true,
      url: spreadsheet.getUrl(),
      name: spreadsheetName,
      tab: tabName
    });
    
  } catch (err) {
    return responseJSON({ ok: false, error: err.toString() });
  }
}

/**
 * Busca un Spreadsheet por nombre en Google Drive, si no existe lo crea
 */
function getOrCreateSpreadsheet(name) {
  var files = DriveApp.getFilesByName(name);
  if (files.hasNext()) {
    var file = files.next();
    return SpreadsheetApp.open(file);
  } else {
    return SpreadsheetApp.create(name);
  }
}

/**
 * Escribe un Cierre Diario completo (Resumen, Tablas, Jugadores)
 */
function writeDailyClosure(sheet, dateStr, daily, tables) {
  // Formatear Fecha para mostrar
  var parts = dateStr.split('-');
  var displayDate = parts[2] + "/" + parts[1] + "/" + parts[0];
  
  // Configuración de estilos
  var colorGold = "#D4AF37";
  var colorHeaderBG = "#1A1A1F";
  var colorLightBG = "#FDFBF7";
  var colorBorder = "#EAEAEA";
  
  // --- TÍTULO ---
  sheet.getRange("A1:F1").merge().setValue("EXPERIENCE POKER ROOM - CIERRE DIARIO")
    .setFontWeight("bold").setFontSize(14).setHorizontalAlignment("center")
    .setBackground(colorHeaderBG).setFontColor(colorGold);
  
  sheet.getRange("A2:F2").merge().setValue("Sesión Operativa: " + displayDate)
    .setFontWeight("bold").setFontSize(11).setHorizontalAlignment("center")
    .setBackground("#2A2A30").setFontColor("#FFFFFF");
  
  sheet.setRowHeight(1, 35);
  sheet.setRowHeight(2, 22);

  // --- SECCIÓN 1: RESUMEN FINANCIERO ---
  sheet.getRange("A4").setValue("RESUMEN DE FLUX").setFontWeight("bold").setFontSize(11).setFontColor(colorGold);
  
  var summaryData = [
    ["Concepto", "Monto / Valor"],
    ["Mesas Cerradas", daily.totalTables || 0],
    ["Rake Total", daily.totalRake || 0],
    ["Rake Neto", daily.totalRakeNeto || 0],
    ["Propinas", daily.totalTips || 0],
    ["Jackpot", daily.totalJackpot || 0],
    ["Promociones", daily.totalPromotions || 0],
    ["RP Comisión", daily.totalRpCommission || 0],
    ["Alimentos y Bebidas (A&B)", daily.totalAbAmount || 0],
    ["Total Fichas (Flujo)", daily.totalFichas || 0],
    ["RPH Promedio", daily.avgRakePerHour || 0],
    ["Ocupación Promedio", (daily.avgOccupancy || 0) / 100],
    ["Responsable", daily.closedBy || "N/A"],
    ["Notas", daily.notes || ""]
  ];
  
  sheet.getRange(5, 1, summaryData.length, 2).setValues(summaryData);
  
  // Estilo Resumen
  sheet.getRange("A5:B5").setBackground(colorHeaderBG).setFontColor("#FFFFFF").setFontWeight("bold");
  sheet.getRange("A6:A18").setFontWeight("bold").setBackground("#F4F4F6");
  sheet.getRange("B6:B16").setHorizontalAlignment("right");
  
  // Formatos Numéricos del Resumen
  sheet.getRange("B7:B15").setNumberFormat("$#,##0.00");
  sheet.getRange("B16").setNumberFormat("$#,##0.00"); // RPH Promedio
  sheet.getRange("B17").setNumberFormat("0.0%"); // Ocupación Promedio
  
  // Bordes Resumen
  sheet.getRange(5, 1, summaryData.length, 2).setBorder(true, true, true, true, true, true, colorBorder, SpreadsheetApp.BorderStyle.SOLID);
  
  var currentLine = 5 + summaryData.length + 2;

  // --- SECCIÓN 2: DETALLE POR MESA ---
  sheet.getRange(currentLine, 1).setValue("DETALLE POR MESA").setFontWeight("bold").setFontSize(11).setFontColor(colorGold);
  currentLine++;
  
  var tableHeaders = [
    "Mesa", "Slot", "Juego", "Ciegas", "Duración", 
    "Rake Total", "Jackpot", "Promociones", "RP Com.", 
    "Rake Neto", "Tips", "Rake/Hora", "RPH Ajustado", "Ocupación"
  ];
  
  sheet.getRange(currentLine, 1, 1, tableHeaders.length).setValues([tableHeaders])
    .setBackground(colorHeaderBG).setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  
  var tableRowStart = currentLine + 1;
  var tableRows = [];
  
  tables.forEach(function(t) {
    tableRows.push([
      t.tableName || t.tableId,
      t.slotNumber || 0,
      t.gameType || "NLHE",
      (t.blinds?.sb || 0) + "/" + (t.blinds?.bb || 0),
      (t.sessionDurationMinutes || t.durationMinutes || 0) + " min",
      t.totalRake || 0,
      t.jackpot || 0,
      t.promotions || 0,
      t.rpCommission || 0,
      t.rakeNeto || 0,
      t.tips || 0,
      t.rakePerHour || 0,
      t.rakePerHourAdjusted || 0,
      (t.occupancyPct || 0) / 100
    ]);
  });
  
  if (tableRows.length > 0) {
    sheet.getRange(tableRowStart, 1, tableRows.length, tableHeaders.length).setValues(tableRows);
    
    // Estilos de filas
    for (var r = 0; r < tableRows.length; r++) {
      var rowIdx = tableRowStart + r;
      if (r % 2 === 1) {
        sheet.getRange(rowIdx, 1, 1, tableHeaders.length).setBackground(colorLightBG);
      }
      sheet.getRange(rowIdx, 5, 1, 10).setHorizontalAlignment("right"); // Duración hasta Ocupación a la derecha
    }
    
    // Formatos de celdas
    sheet.getRange(tableRowStart, 6, tableRows.length, 8).setNumberFormat("$#,##0.00"); // Valores de Rake
    sheet.getRange(tableRowStart, 14, tableRows.length, 1).setNumberFormat("0%"); // Ocupación
    
    // Bordes Tabla
    sheet.getRange(currentLine, 1, tableRows.length + 1, tableHeaders.length)
      .setBorder(true, true, true, true, true, true, colorBorder, SpreadsheetApp.BorderStyle.SOLID);
    
    currentLine += tableRows.length + 2;
  } else {
    sheet.getRange(tableRowStart, 1).setValue("No hay mesas registradas en esta sesión.");
    currentLine += 3;
  }
  
  // --- SECCIÓN 3: JUGADORES Y COMPRAS ---
  sheet.getRange(currentLine, 1).setValue("DETALLE DE JUGADORES").setFontWeight("bold").setFontSize(11).setFontColor(colorGold);
  currentLine++;
  
  var playerHeaders = ["Mesa", "Asiento", "Jugador", "Fichas Finales", "Buy-ins Comprados", "Tiempo Jugado"];
  sheet.getRange(currentLine, 1, 1, playerHeaders.length).setValues([playerHeaders])
    .setBackground(colorHeaderBG).setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  
  var playerRowStart = currentLine + 1;
  var playerRows = [];
  
  tables.forEach(function(tc) {
    var pList = tc.players || [];
    pList.forEach(function(p) {
      if (p.name) {
        playerRows.push([
          tc.tableName || tc.tableId,
          "Asiento " + p.seatNumber,
          p.name,
          p.chips || 0,
          p.buyIns || 0,
          Math.round((p.playTimeMs || 0) / 60000) + " min"
        ]);
      }
    });
  });
  
  if (playerRows.length > 0) {
    sheet.getRange(playerRowStart, 1, playerRows.length, playerHeaders.length).setValues(playerRows);
    
    for (var r = 0; r < playerRows.length; r++) {
      var rowIdx = playerRowStart + r;
      if (r % 2 === 1) {
        sheet.getRange(rowIdx, 1, 1, playerHeaders.length).setBackground(colorLightBG);
      }
      sheet.getRange(rowIdx, 4, 1, 3).setHorizontalAlignment("right"); // Fichas, Buy-ins y Tiempo a la derecha
    }
    
    sheet.getRange(playerRowStart, 4, playerRows.length, 1).setNumberFormat("$#,##0.00"); // Fichas finales como moneda
    sheet.getRange(playerRowStart, 5, playerRows.length, 1).setNumberFormat("#,##0"); // Compras
    
    // Bordes Tabla Jugadores
    sheet.getRange(currentLine, 1, playerRows.length + 1, playerHeaders.length)
      .setBorder(true, true, true, true, true, true, colorBorder, SpreadsheetApp.BorderStyle.SOLID);
  } else {
    sheet.getRange(playerRowStart, 1).setValue("No hay jugadores registrados en esta sesión.");
  }
  
  // Auto-ajustar anchos de columnas
  for (var col = 1; col <= tableHeaders.length; col++) {
    sheet.autoResizeColumn(col);
    // Añadir un margen extra de ancho
    sheet.setColumnWidth(col, sheet.getColumnWidth(col) + 15);
  }
}

/**
 * Escribe un Cierre de Mesa Individual
 */
function writeSingleTableClosure(sheet, dateStr, closure) {
  // Para cierres individuales, si no existe estructura, creamos un bloque de resumen del cierre
  // Si ya existían datos, los reemplazamos. Para simplificar, escribimos un formato limpio de la mesa.
  writeDailyClosure(sheet, dateStr, {
    totalTables: 1,
    totalRake: closure.totalRake,
    totalRakeNeto: closure.rakeNeto,
    avgRakePerHour: closure.rakePerHour,
    avgOccupancy: closure.occupancyPct,
    totalJackpot: closure.jackpot,
    totalTips: closure.tips,
    totalPromotions: closure.promotions,
    totalRpCommission: closure.rpCommission,
    totalAbAmount: closure.abAmount,
    totalFichas: closure.totalFichas,
    notes: closure.notes,
    closedBy: closure.closedBy
  }, [closure]);
}

/**
 * Escribe la exportación de un torneo en su propia pestaña y actualiza el resumen mensual.
 */
function writeTournamentExport(payload) {
  var name = payload.tournamentName || "Torneo";
  var id = payload.tournamentId || "unknown";
  var isMulti = payload.isMultiDay || false;
  var days = payload.days || [];
  var total = payload.total || {};
  
  // Sanitizar nombre para pestaña (máx 100 chars, sin caracteres especiales)
  var tabName = name.replace(/[\/\\\?\*\[\]]/g, "").substring(0, 100);
  
  // Documento donde se guardan los torneos
  var spreadsheet = getOrCreateSpreadsheet("Torneos - Experience Poker Room");
  
  // === PESTAÑA POR TORNEO ===
  var sheet = spreadsheet.getSheetByName(tabName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = spreadsheet.insertSheet(tabName);
  }
  spreadsheet.setActiveSheet(sheet);
  
  // Ocultar hoja default
  var defaultSheet = spreadsheet.getSheetByName("Hoja 1") || spreadsheet.getSheetByName("Sheet1");
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    try { spreadsheet.deleteSheet(defaultSheet); } catch(e) {}
  }
  
  var colorGold = "#D4AF37";
  var colorHeaderBG = "#1A1A1F";
  var colorLightBG = "#FDFBF7";
  var colorBorder = "#EAEAEA";
  
  // Título
  sheet.getRange("A1:F1").merge().setValue("TORNEO: " + name)
    .setFontWeight("bold").setFontSize(14).setHorizontalAlignment("center")
    .setBackground(colorHeaderBG).setFontColor(colorGold);
  
  // Encabezados de tabla
  var headers = ["Día", "Fecha", "Entradas", "Recompras", "Add-ons", "Total Buy-in", "Rake"];
  sheet.getRange("A3:G3").setValues([headers])
    .setBackground(colorHeaderBG).setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  
  var row = 4;
  var totalEntries = 0, totalRebuys = 0, totalAddons = 0;
  var totalAmount = 0, totalRake = 0;
  
  // Filas por día
  days.forEach(function(d) {
    var dayTotal = (d.totalBuyinsAmount || 0) + (d.totalRebuysAmount || 0) + (d.totalAddonsAmount || 0);
    var dayRake = (d.totalBuyinsRake || 0) + (d.totalRebuysRake || 0) + (d.totalAddonsRake || 0);
    totalEntries += d.entries || 0;
    totalRebuys += d.rebuys || 0;
    totalAddons += d.addons || 0;
    totalAmount += dayTotal;
    totalRake += dayRake;
    
    sheet.getRange(row, 1, 1, 7).setValues([[
      d.dayLabel || "—",
      d.savedAt || "",
      d.entries || 0,
      d.rebuys || 0,
      d.addons || 0,
      dayTotal,
      dayRake
    ]]);
    if ((row - 4) % 2 === 1) {
      sheet.getRange(row, 1, 1, 7).setBackground(colorLightBG);
    }
    row++;
  });
  
  // Fila de totales (solo para multi-día)
  if (isMulti && days.length > 1) {
    var targetRake = totalAmount * ((total.rakePct || 0) / 100);
    var prizePool = Math.max(total.guarantee || 0, totalAmount - targetRake);
    var roomProfit = totalAmount - prizePool;
    
    sheet.getRange(row, 1, 1, 7).setValues([[
      "ACUMULADO", "—", totalEntries, totalRebuys, totalAddons, totalAmount, totalRake
    ]]).setFontWeight("bold").setBackground(colorGold + "20");
    sheet.getRange(row, 1, 1, 7).setBorder(true, true, true, true, true, true, colorBorder, SpreadsheetApp.BorderStyle.SOLID);
    row += 2;
    
    // Resumen financiero
    sheet.getRange(row, 1).setValue("RESUMEN FINANCIERO").setFontWeight("bold").setFontSize(11).setFontColor(colorGold);
    row++;
    var finData = [
      ["Garantizado", total.guarantee || 0],
      ["% Rake Casa", (total.rakePct || 0) + "%"],
      ["Total Acumulado", totalAmount],
      ["Rake Objetivo (" + (total.rakePct || 0) + "%)", targetRake],
      ["Premios a Repartir", prizePool],
      ["Ganancia Casa", roomProfit],
    ];
    sheet.getRange(row, 1, finData.length, 2).setValues(finData);
    sheet.getRange(row, 1, finData.length, 1).setFontWeight("bold");
    sheet.getRange(row, 2, finData.length, 1).setNumberFormat("$#,##0.00").setHorizontalAlignment("right");
    row += finData.length + 1;
  }
  
  // Auto-ajustar columnas
  for (var col = 1; col <= 7; col++) {
    sheet.autoResizeColumn(col);
    sheet.setColumnWidth(col, sheet.getColumnWidth(col) + 15);
  }
  
  // === PESTAÑA DE RESUMEN MENSUAL ===
  var monthKey = new Date().toISOString().substring(0, 7); // YYYY-MM
  var monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var monthName = monthNames[parseInt(monthKey.split('-')[1], 10) - 1];
  var summaryTabName = "Resumen " + monthName + " " + monthKey.split('-')[0];
  
  var summarySheet = spreadsheet.getSheetByName(summaryTabName);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(summaryTabName);
    // Encabezados
    var sumHeaders = ["Torneo", "Tipo", "Entradas", "Recompras", "Add-ons", "Total Acumulado", "Rake", "Premios", "Ganancia Casa"];
    summarySheet.getRange("A1:I1").setValues([sumHeaders])
      .setBackground(colorHeaderBG).setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  }
  
  // Buscar si el torneo ya existe en el resumen y actualizarlo
  var existingData = summarySheet.getDataRange().getValues();
  var foundRow = -1;
  for (var r = 1; r < existingData.length; r++) {
    if (existingData[r][0] === name) { foundRow = r + 1; break; }
  }
  
  var typeLabel = isMulti ? "Multi-día" : "Un día";
  var targetRake2 = totalAmount * ((total.rakePct || 0) / 100);
  var prizePool2 = Math.max(total.guarantee || 0, totalAmount - targetRake2);
  var roomProfit2 = totalAmount - prizePool2;
  
  var summaryRow = [name, typeLabel, totalEntries, totalRebuys, totalAddons, totalAmount, totalRake, prizePool2, roomProfit2];
  
  if (foundRow > 0) {
    summarySheet.getRange(foundRow, 1, 1, 9).setValues([summaryRow]);
  } else {
    var nextRow = summarySheet.getLastRow() + 1;
    summarySheet.getRange(nextRow, 1, 1, 9).setValues([summaryRow]);
    if ((nextRow - 2) % 2 === 1) {
      summarySheet.getRange(nextRow, 1, 1, 9).setBackground(colorLightBG);
    }
  }
  
  // Formato de moneda en resumen
  var lastSummaryRow = summarySheet.getLastRow();
  if (lastSummaryRow > 1) {
    summarySheet.getRange(2, 6, lastSummaryRow - 1, 4).setNumberFormat("$#,##0.00").setHorizontalAlignment("right");
    summarySheet.getRange(2, 3, lastSummaryRow - 1, 3).setHorizontalAlignment("right");
    summarySheet.getRange(1, 1, 1, 9).setBorder(true, true, true, true, true, true, colorBorder, SpreadsheetApp.BorderStyle.SOLID);
  }
  for (var col = 1; col <= 9; col++) {
    summarySheet.autoResizeColumn(col);
    summarySheet.setColumnWidth(col, summarySheet.getColumnWidth(col) + 15);
  }
  
  return responseJSON({
    ok: true,
    url: spreadsheet.getUrl(),
    name: spreadsheet.getName(),
    tab: tabName
  });
}
function responseJSON(json) {
  return ContentService.createTextOutput(JSON.stringify(json))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Paso 2: Implementar y Obtener la URL Web App

1. Dentro de tu proyecto de Google Apps Script, haz clic en el botón azul **Implementar** (Deploy) en la parte superior derecha y selecciona **Nueva implementación** (New deployment).
2. Haz clic en el icono de engranaje de "Seleccionar tipo" y elige **Aplicación web** (Web app).
3. Configura las siguientes opciones:
   - **Descripción**: `Poker Room Cierres v2 (con torneos)`
   - **Ejecutar como (Execute as)**: **Yo** (tu cuenta de correo de Google)
   - **Quién tiene acceso (Who has access)**: **Cualquier persona** (Anyone)
     > [!IMPORTANT]
     > Debes seleccionar "Cualquier persona" (o "Anyone") para que la aplicación frontend pueda enviar los datos sin requerir autenticación OAuth explícita por cada usuario cliente.
4. Haz clic en **Implementar**.
5. Google te pedirá autorizar el acceso. Haz clic en **Autorizar acceso**, selecciona tu cuenta de correo, haz clic en **Configuración avanzada** (Advanced) abajo a la izquierda, y luego en **Ir a Poker Room Cierres Webhook (no seguro)**. Concede los permisos necesarios.
6. Una vez completado, copia la **URL de la aplicación web** generada (ej. `https://script.google.com/macros/s/AKfycb.../exec`).

## Paso 3: Configurar en el Dashboard

1. Inicia el sistema y abre la pantalla de **Cierre del Día** o cierra una mesa activa.
2. Haz clic en el botón de **Configuración** (icono de engranaje) al lado del botón de exportación.
3. Pega la URL copiada de la aplicación web de Google en el campo **URL Web App de Google Sheets**.
4. Define la **Hora de Corte** de tus sesiones operativas (por defecto 6:00 AM).
5. Guarda la configuración. ¡Listo! Ya puedes exportar directamente a Google Sheets.

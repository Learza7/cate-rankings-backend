
function convertToDate(dateString) {
    // Split the date string into its components
    const [year, month] = dateString.split('-');
  
    // Create a map of month abbreviations to their number
    const monthMap = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12'
    };
  
    // Convert the month abbreviation to a number
    const monthNumber = monthMap[month];
  
    // Construct the date string in a format the Date constructor can interpret
    const newDateString = `${year}-${monthNumber}-01`;
  
    // Return the new Date object
    return new Date(newDateString);
  }

    module.exports = convertToDate;
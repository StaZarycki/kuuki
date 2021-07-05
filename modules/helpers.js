const ReturnDateFormat = Object.freeze({"year": 0, "month": 1, "hour": 2, "full": 3});

const stringToDate = function(dateString)
{
    // Format: day-month-year hour:minute
    const year = parseInt(dateString.substring(6, 10));
    const month = parseInt(dateString.substring(3, 5)) - 1;
    const day = parseInt(dateString.substring(0, 2));
    const hour = parseInt(dateString.substring(11, 13)) - 2;
    const minute = parseInt(dateString.substring(14, 16));

    const date = new Date(year, month, day, hour, minute, 0);

    return date;
}

const dateToString = function(date, returnFormat)
{
    const parseDate = new Date(Date.parse(date));
    const year = parseDate.getFullYear();
    const month = parseDate.getMonth() + 1;
    const day = parseDate.getDate();
    const hour = parseDate.getHours() + 2;
    const minute = parseDate.getMinutes();

    // Formats: year, month, hour, full
    let returnString = "";
    switch (returnFormat)
    {
        case ReturnDateFormat.year:
            returnString = `${day < 10 ? "0" + day : day}-${month < 10 ? "0" + month : month}-${year}`;
            break;
        case ReturnDateFormat.month:
            returnString = `${day < 10 ? "0" + day : day}-${month < 10 ? "0" + month : month}`;
            break;
        case ReturnDateFormat.hour:
            returnString = `${hour < 10 ? "0" + hour : hour}:${minute < 10 ? "0" + minute : minute}`;
            break;
        case ReturnDateFormat.full:
            returnString = `${day < 10 ? "0" + day : day}-${month < 10 ? "0" + month : month}-${year} ${hour < 10 ? "0" + hour : hour}:${minute < 10 ? "0" + minute : minute}`;
            break;
    }

    return returnString;
}

module.exports = {
    ReturnDateFormat: ReturnDateFormat,
    stringToDate: function(dateString)
    {
        return stringToDate(dateString);
    },
    dateToString: function(date, returnFormat)
    {
        return dateToString(date, returnFormat);
    }
}

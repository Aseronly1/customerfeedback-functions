var path = require('path');
var Jimp = require("jimp");
var azurestorage = require("azure-storage");
var name;

module.exports = function (context, data) {
    name = data.body.CustomerName;
    var code = getRandomInt(100,99999);
    
    context.log("Coupon generation for: ", name, " code: " + code);


    // Load coupon image and read it with Jimp
    var baseImgPath = path.resolve(__dirname, 'coupon.jpg');
    context.log("Template image path: " + baseImgPath);

    Jimp.read(baseImgPath).then((image) => {
        // Load font
        Jimp.loadFont(Jimp.FONT_SANS_8_BLACK).then(function (font) {
            // Write the customer name on the image
            image.print(font, 60, 150, "25% off voucher for " + data.CustomerName);
            // Get the image as a stream
            image.getBuffer(Jimp.MIME_JPEG, (error, stream) => {
                
                // Generate SAS url
                var blobLocation = generateSasToken(context, 'coupons', name + '.jpg', 'r').uri;
                // Return the outputBlob SAS url
                context.res = { 
                    body: {
                        CouponUrl: blobLocation 
                    }
                };
                context.log("Output url: " + blobLocation);

                // Bind the stream to the output binding to create a new blob
                context.done(null, { outputBlob: stream,  });
            });
        });
    });

    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    }

    function generateSasToken(context, container, blobName, permissions) {
        
        try
        {
             var connString = process.env.BlobStorageConnection;
             var blobService = azurestorage.createBlobService(connString);
 
             // Create a SAS token that expires in an hour
             // Set start time to five minutes ago to avoid clock skew.
             var startDate = new Date();
             startDate.setMinutes(startDate.getMinutes() - 5);
             var expiryDate = new Date(startDate);
             expiryDate.setMinutes(startDate.getMinutes() + 60);
 
             permissions = permissions || azurestorage.BlobUtilities.SharedAccessPermissions.READ;
 
             var sharedAccessPolicy = {
                 AccessPolicy: {
                     Permissions: permissions,
                     Start: startDate,
                     Expiry: expiryDate
                 }
             };
 
             var sasToken = blobService.generateSharedAccessSignature(container, blobName, sharedAccessPolicy);
 
             return {
                 token: sasToken,
                 uri: blobService.getUrl(container, blobName, sasToken, true)
             };
 
        }
        catch(e)
        {
            context.log(e.message);
        }
      }
};
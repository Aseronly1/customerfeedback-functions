var path = require('path');
var Jimp = require("jimp");
var azurestorage = require("azure-storage");
var stream = require('stream');
var util = require('util');

module.exports = function (context, data) {

    context.log(util.inspect(data, false, null))

    var name = data.body.CustomerName;
    var code = getRandomInt(100, 99999);
    var outputFileName = name + "_" + code + ".jpg";

    context.log("Coupon generation for: ", name, " code: " + code);


    // Load coupon image and read it with Jimp
    var baseImgPath = path.resolve(__dirname, 'coupon.jpg');
    context.log("Template image path: " + baseImgPath);

    Jimp.read(baseImgPath).then((image) => {
        // Load font
        Jimp.loadFont(Jimp.FONT_SANS_32_BLACK).then(function (font) {
            // Write the customer name on the image
            image.print(font, 60, 150, "25% off voucher for " + name);
            // Get the image as a stream
            image.getBuffer(Jimp.MIME_JPEG, (error, buffer) => {

                // Save Stream to blob
                var imageStream = new stream.PassThrough();
                imageStream.end(buffer);
                saveStreamToBlockBlob(context, 'coupons', outputFileName, imageStream);

                // Generate SAS url
                var blobLocation = generateSasToken(context, 'coupons', outputFileName, 'r').uri;

                // Return the outputBlob SAS url
                context.res = {
                    body: {
                        CouponUrl: blobLocation
                    }
                };
                context.log("Output url: " + blobLocation);
                context.done();
            });
        });
    });

    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    }

    function saveStreamToBlockBlob(context, container, blobName, stream) {
        var connString = process.env.BlobStorageConnection;
        var blobService = azurestorage.createBlobService(connString);

        context.log("Saving stream to block blob");
        //console.log(util.inspect(stream, false, null))


        try {
            // Create the container if it doesn't exist
            context.log("Creating container if it doesn't exist");
            blobService.createContainerIfNotExists(container,
                (error, result, response) => {
                    if (error) {
                        context.error("Unable to create container: " + error);
                    } else {
                        context.log("Container exists, or created.");

                        // Pipe the stream to a block blob
                        stream.pipe(blobService.createWriteStreamToBlockBlob(container, blobName, 
                            {
                                contentSettings: {
                                    contentType: 'image/jpg',
                                }
                            },
                            (error, result, response) => {
                                if (error) {
                                    context.error("Unable to upload stream: " + error);
                                } else {
                                    // file uploaded, return 
                                    context.log("Blob uploaded");
                                }
                            }));
                    }
                });

        } catch (e) {
            context.log("Exception saving stream: " + e.message);
        }
    }

    function generateSasToken(context, container, blobName, permissions) {

        try {
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

        } catch (e) {
            context.log(e.message);
        }
    }
};
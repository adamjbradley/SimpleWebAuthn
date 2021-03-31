/* eslint-disable @typescript-eslint/ban-ts-comment */
// `ASN1HEX` exists in the lib but not in its typings
// @ts-ignore 2305
import { X509, zulutodate, ASN1HEX } from 'jsrsasign';

export type CertificateInfo = {
  issuer: { [key: string]: string };
  subject: { [key: string]: string };
  version: number;
  basicConstraintsCA: boolean;
  notBefore: Date;
  notAfter: Date;
};

type ExtInfo = {
  critical: boolean;
  oid: string;
  vidx: number;
};

interface x5cCertificate extends jsrsasign.X509 {
  version: number;
  foffset: number;
  aExtInfo: ExtInfo[];
}

/**
 * Extract PEM certificate info
 *
 * @param pemCertificate Result from call to `convertASN1toPEM(x5c[0])`
 */
export default function getCertificateInfo(pemCertificate: string): CertificateInfo {
  const subjectCert = new X509();
  subjectCert.readCertPEM(pemCertificate);

  // Break apart the Issuer
  const issuerString = subjectCert.getIssuerString();
  const issuerParts = issuerString.slice(1).split('/');

  const issuer: { [key: string]: string } = {};
  issuerParts.forEach(field => {
    const [key, val] = field.split('=');
    issuer[key] = val;
  });

  // Break apart the Subject
  let subjectRaw = '/';
  try {
    subjectRaw = subjectCert.getSubjectString();
  } catch (err) {
    // Don't throw on an error that indicates an empty subject
    if (err !== 'malformed RDN') {
      throw err;
    }
  }
  const subjectParts = subjectRaw.slice(1).split('/');

  const subject: { [key: string]: string } = {};
  subjectParts.forEach(field => {
    if (field) {
      const [key, val] = field.split('=');
      subject[key] = val;
    }
  });

  const { version } = subjectCert as x5cCertificate;
  let basicConstraintsCA = false;
  try {
    // TODO: Simplify this when jsrsasign gets updated (see note below). Ideally this is all the
    // logic we need to determine `basicConstraintsCA`
    basicConstraintsCA = !!subjectCert.getExtBasicConstraints()?.cA;
  } catch (err) {
    /**
     * This is a workaround till jsrsasign's X509.getExtBasicConstraints() can recognize this
     * legitimate value. See verifyPacked.test.ts for more context.
     */
    // Example error message: "hExtV parse error: 3003010100"
    if (`${err.message}`.indexOf('3003010100') >= 0) {
      const basicConstraintsInfo = subjectCert.getExtInfo('basicConstraints');

      if (typeof basicConstraintsInfo === 'object' && basicConstraintsInfo.vidx) {
        const hExtV = ASN1HEX.getTLV(subjectCert.hex, basicConstraintsInfo.vidx);
        if (hExtV === '3003010100') {
          basicConstraintsCA = false;
        } else {
          throw err;
        }
      }
    } else {
      throw err;
    }
  }

  return {
    issuer,
    subject,
    version,
    basicConstraintsCA,
    notBefore: zulutodate(subjectCert.getNotBefore()),
    notAfter: zulutodate(subjectCert.getNotAfter()),
  };
}

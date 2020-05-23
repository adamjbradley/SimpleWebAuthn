import jsrsasign from 'jsrsasign';
import { CertificateInfo } from '@webauthntine/typescript-types';

type ExtInfo = {
  critical: boolean,
  oid: string,
  vidx: number,
};

interface x5cCertificate extends jsrsasign.X509 {
  version: number;
  foffset: number;
  aExtInfo: ExtInfo[];
};

/**
 * Extract PEM certificate info
 *
 * @param pemCertificate Result from call to `convertASN1toPEM(x5c[0])`
 */
export default function getCertificateInfo(pemCertificate: string): CertificateInfo {
  const subjectCert = new jsrsasign.X509();
  subjectCert.readCertPEM(pemCertificate);

  const { version, getSubjectString, getExtBasicConstraints } = (subjectCert as x5cCertificate);

  const subjectString = getSubjectString();
  const subjectParts = subjectString.slice(1).split('/');

  const subject: { [key: string]: string } = {};
  subjectParts.forEach((field) => {
    const [key, val] = field.split('=');
    subject[key] = val;
  });


  const basicConstraintsCA = !!getExtBasicConstraints().cA;

  return {
    subject,
    version,
    basicConstraintsCA,
  };
}
